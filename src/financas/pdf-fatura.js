// financas/pdf-fatura.js — lê o PDF da fatura do cartão e devolve as linhas no mesmo formato
// que o campo "Lançamentos" da importação já entende (data · descrição · parcela · valor).

/* pdf.js vem do CDN e só é baixado no primeiro uso (~1 MB): embutir no build single-file
   dobraria o tamanho do app para uma função usada uma vez por mês. Mesmo padrão do Firebase.
   Versão fixa: 3.11.174 é a última com build UMD (global pdfjsLib); a 4.x só tem ESM.
   jsDelivr serve o pacote do npm byte a byte — o mesmo testado com as faturas reais. */
const PDFJS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
let _carregando=null;
export function finPdfLib(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(_carregando) return _carregando;
  _carregando=new Promise((ok,erro)=>{
    const s=document.createElement('script'); s.src=PDFJS+'pdf.min.js';
    s.onload=()=>{ const lib=window.pdfjsLib; if(!lib){ erro(new Error('pdf.js não carregou')); return; }
      lib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js'; ok(lib); };
    s.onerror=()=>{ _carregando=null; erro(new Error('Sem conexão para carregar o leitor de PDF')); };
    document.head.appendChild(s);
  });
  return _carregando;
}

/* ---- parser (puro, sem DOM: testável no Node) ----
   Entrada: itens de texto do pdf.js já achatados {p:página, x, y, s:texto}.
   Faturas em PDF são tabelas posicionadas, muitas vezes em DUAS colunas por página. Ler o texto
   na ordem do arquivo embaralha as colunas (era isso que dava trabalho no copiar/colar).
   Aqui cada lançamento é ancorado pela DATA (dd/mm) e pelo VALOR mais à direita na mesma linha,
   antes da próxima data dessa linha — então duas colunas lado a lado viram dois lançamentos.
   Descrição = itens entre a data e o valor, inclusive quebra de linha ("…03 DE" / "04"),
   atribuídos à linha-âncora mais próxima na vertical. */
const RX_DATA=/^\d{2}\/\d{2}$/;
const RX_VALOR=/^-?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?[DC])?$/i;
const MESMA_LINHA=1.5, QUEBRA=5.5;

export function finPdfLinhas(itens){
  const out=[], porPag={};
  itens.forEach(i=>{ const s=String(i.s||'').trim(); if(s)(porPag[i.p]||(porPag[i.p]=[])).push({...i,s}); });
  Object.keys(porPag).sort((a,b)=>a-b).forEach(p=>{
    const its=porPag[p];
    const datas=its.filter(i=>RX_DATA.test(i.s)), vals=its.filter(i=>RX_VALOR.test(i.s));
    const ancoras=[];
    datas.forEach(d=>{
      const prox=datas.filter(o=>o!==d&&Math.abs(o.y-d.y)<=MESMA_LINHA&&o.x>d.x).reduce((m,o)=>Math.min(m,o.x),Infinity);
      /* PRIMEIRO valor depois da data, não o último: a coluna vizinha sem data ("Total final
         (cartão 9134) 966,46D") pode cair na mesma altura. Valor com D/C tem prioridade — sem
         sufixo costuma ser a coluna U$$ de compra internacional. */
      const naLinha=vals.filter(o=>Math.abs(o.y-d.y)<=MESMA_LINHA&&o.x>d.x&&o.x<prox).sort((a,b)=>a.x-b.x);
      const v=naLinha.find(o=>/[DC]$/i.test(o.s))||naLinha[0];
      if(v) ancoras.push({d,v,y:d.y,desc:[]});
    });
    // anuidade vem sem data ("ANUIDADE DIFERENCIADA TIT 07/ 12 … 13,80D"): é cobrança real
    its.filter(i=>/^ANUIDADE\s+\S/i.test(i.s)).forEach(a=>{
      const v=vals.filter(o=>Math.abs(o.y-a.y)<=MESMA_LINHA&&o.x>a.x&&o.x-a.x<320).sort((x,y)=>x.x-y.x)[0];
      if(v&&finPdfNum(v.s)>0) ancoras.push({d:null,a,v,y:a.y,desc:[a]});
    });
    const usados=new Set(ancoras.flatMap(x=>[x.d,x.v,x.a].filter(Boolean)));
    its.forEach(i=>{
      if(usados.has(i)||RX_DATA.test(i.s)||RX_VALOR.test(i.s)) return;
      let melhor=null, dist=Infinity;
      ancoras.forEach(an=>{ const x0=an.d?an.d.x:an.a.x;
        if(i.x>x0&&i.x<an.v.x){ const dy=Math.abs(i.y-an.y); if(dy<dist){dist=dy;melhor=an;} } });
      if(melhor&&dist<=QUEBRA) melhor.desc.push(i);
    });
    ancoras.sort((a,b)=>b.y-a.y||(a.d?a.d.x:a.a.x)-(b.d?b.d.x:b.a.x)).forEach(an=>{
      // ordem de leitura dentro da célula: por coluna (x), e de cima para baixo na quebra de linha
      const desc=an.desc.slice().sort((a,b)=>Math.round(a.x/4)-Math.round(b.x/4)||b.y-a.y)
        .map(i=>i.s).join(' ').replace(/(\d{1,2})\/\s+(\d{1,2})\b/g,'$1/$2').replace(/\s+/g,' ').trim();
      const v=an.v.s.replace(/\s+/g,'').replace(/^R\$/i,'');
      out.push(((an.d?an.d.s+' ':'')+desc+' '+v).trim());
    });
  });
  return out;
}
export function finPdfNum(s){
  const m=String(s).replace(/\s+/g,'').match(/(-?)(?:R\$)?([\d.]+,\d{2})([DC]?)/i); if(!m) return NaN;
  const v=+m[2].replace(/\./g,'').replace(',','.');
  return (m[1]==='-'||/c/i.test(m[3]))?-v:v;
}
/* Vencimento e total impressos na fatura — servem para escolher a fatura certa sozinho e
   para conferir se a extração pegou tudo (soma das linhas + linhas ignoradas = total). */
export function finPdfMeta(itens){
  const txt=itens.map(i=>String(i.s||'').trim()).filter(Boolean);
  let venc='';
  const iv=itens.find(i=>/^vencimento$/i.test(String(i.s).trim()));
  if(iv){ const c=itens.filter(i=>i.p===iv.p&&/^\d{2}\/\d{2}\/\d{4}$/.test(String(i.s).trim())&&i.y<iv.y&&iv.y-i.y<40&&Math.abs(i.x-iv.x)<80)
      .sort((a,b)=>(iv.y-a.y)-(iv.y-b.y))[0];
    if(c){ const [d,m,y]=String(c.s).trim().split('/'); venc=`${y}-${m}-${d}`; } }
  let total=null;
  const it=itens.find(i=>/valor total desta fatura/i.test(String(i.s)));
  if(it){ const lin=itens.filter(i=>i.p===it.p&&Math.abs(i.y-it.y)<=MESMA_LINHA&&i.x>=it.x).sort((a,b)=>a.x-b.x).map(i=>String(i.s)).join(' ');
    const n=finPdfNum(lin.replace(/valor total desta fatura/i,'')); if(isFinite(n)) total=n; }
  if(total==null){ const k=txt.findIndex(s=>/^valor total desta fatura$/i.test(s)); if(k>=0){ const n=finPdfNum(txt[k+1]||''); if(isFinite(n)) total=n; } }
  return {venc,total};
}

/* Arquivo → {linhas, venc, total}. Pede a senha se o banco protegeu o PDF. */
export async function finPdfExtrair(file){
  const lib=await finPdfLib();
  const data=new Uint8Array(await file.arrayBuffer());
  let doc=null, senha;
  for(let tent=0;tent<3&&!doc;tent++){
    try{ doc=await lib.getDocument({data:data.slice(),password:senha}).promise; }
    catch(e){
      if(e&&e.name==='PasswordException'){
        senha=prompt(tent?'Senha incorreta. Senha do PDF da fatura:':'Este PDF tem senha (na Caixa costuma ser parte do CPF). Senha:');
        if(senha==null) throw new Error('Importação cancelada');
      }else throw e;
    }
  }
  if(!doc) throw new Error(senha!==undefined?'Senha incorreta 3 vezes — anexe o PDF de novo para tentar outra vez':'Não consegui abrir o PDF');
  const itens=[];
  for(let p=1;p<=doc.numPages;p++){
    const tc=await (await doc.getPage(p)).getTextContent();
    tc.items.forEach(i=>{ if(i.str&&i.str.trim()) itens.push({p,x:i.transform[4],y:i.transform[5],s:i.str}); });
  }
  if(!itens.length) throw new Error('O PDF não tem texto (é uma imagem escaneada) — use o copiar e colar');
  return {linhas:finPdfLinhas(itens),...finPdfMeta(itens)};
}
