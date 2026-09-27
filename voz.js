// financas/voz.js — gerado a partir do monólito; edite aqui a partir de agora.
import { uid } from '../core/app.js';
import { todayISO } from '../core/datas.js';
import { closeModal, h, modal, toast } from '../ui/base.js';
import { current } from '../ui/router.js';
import { addDaysISO } from '../views/analytics/graficos.js';
import { FIN_CATS, FIN_KW, FIN_MEIOS, fin, finCat, finCatById, finSave } from './core.js';
import { brl, escRe, finFaturaDaCompra, finNorm, finVal, parseBRL, r2, ymAdd, ymDia } from './util.js';
import { vFinancas } from './view.js';

/* ---------------- parser de fala (pt-BR, local, sem API) ---------------- */
export const FIN_NUM={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,
  quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,
  sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,duzentas:200,trezentos:300,trezentas:300,
  quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};
export const FIN_CTX_NUM=new Set(['real','reais','mil','vez','vezes','parcela','parcelas','conto','contos','x']);
export const FIN_VERBOS=new Set(['gastei','gasto','paguei','pago','comprei','comprado','custou','deu','foi','fiz','tomei','pedi','abasteci']);
export const FIN_STOP=new Set(['com','no','na','nos','nas','em','de','do','da','dos','das','um','uma','o','a','os','as','pelo','pela','pra','pro','para','por',
  'via','usando','pagamento','e','meu','minha','reais','real','centavos','centavo','conto','contos','rs','que','aqui','agora','tipo','cartao','valor']);
export function finWordsToNum(t){
  const tk=t.split(/\s+/).filter(Boolean), out=[]; let i=0;
  while(i<tk.length){
    const w=tk[i];
    if(FIN_NUM[w]!==undefined||w==='mil'){
      let total=0,cur=0,j=i,last=i,usados=[];
      while(j<tk.length){
        const x=tk[j];
        if(FIN_NUM[x]!==undefined){cur+=FIN_NUM[x];usados.push(x);last=j;j++;}
        else if(x==='mil'){cur=(cur||1)*1000;total+=cur;cur=0;usados.push(x);last=j;j++;}
        else if(x==='e'&&j+1<tk.length&&(FIN_NUM[tk[j+1]]!==undefined||tk[j+1]==='mil')&&usados.length){j++;}
        else break;
      }
      // "um lanche": artigo, não número — só converte com contexto numérico
      if(usados.length===1&&(usados[0]==='um'||usados[0]==='uma')&&!FIN_CTX_NUM.has(tk[last+1]||'')){out.push(w);i++;continue;}
      out.push(String(total+cur)); i=last+1;
    }else{out.push(w);i++;}
  }
  return out.join(' ');
}
export function finCategorizar(descNorm){
  const words=descNorm.split(/\s+/).map(w=>w.replace(/[^a-z0-9]/g,'')).filter(Boolean);
  for(const w of words) if(fin.aprendido[w]&&finCatById(fin.aprendido[w])) return {cat:fin.aprendido[w],fonte:'aprendido'};
  const pad=' '+words.join(' ')+' ';
  for(const [k,c] of FIN_KW) if(pad.includes(' '+k+' ')) return {cat:c,fonte:'dicionario'};
  return {cat:'outros',fonte:''};
}
export function finAprender(desc,cat){
  finNorm(desc).split(/\s+/).map(w=>w.replace(/[^a-z0-9]/g,''))
    .filter(w=>w.length>=3&&!FIN_STOP.has(w)&&!FIN_VERBOS.has(w)&&!/^\d+$/.test(w))
    .slice(0,3).forEach(w=>{fin.aprendido[w]=cat;});
}
export function finParse(raw,origem){
  const flags=[]; let m;
  let t=finNorm(raw).replace(/r\s*\$/g,' rs ').replace(/(\d)\s*x\b/g,'$1 x')
        .replace(/([^\d])[.,]/g,'$1 ').replace(/[.,](?!\d)/g,' ').replace(/[^a-z0-9\s.,]/g,' ');
  t=' '+finWordsToNum(t)+' ';
  const cut=re=>{const r=t.match(re); if(r) t=t.replace(r[0],' '); return r;};

  // parcelas
  let parc=1;
  if(m=cut(/\s(?:em\s+|parcelad[oa]\s+em\s+)?(\d{1,2})\s+(?:x|vezes|parcelas?)\s/)) parc=Math.max(1,+m[1]);
  if(cut(/\sa\s+vista\s/)) parc=1;
  const falouParcelado=!!cut(/\sparcelad[oa]\s/);

  // data
  let data=todayISO();
  if(cut(/\santeontem\s/)) data=addDaysISO(data,-2);
  else if(cut(/\sontem\s/)) data=addDaysISO(data,-1);
  else if(m=cut(/\s(?:no\s+)?dia\s+(\d{1,2})\s/)){
    const ym=todayISO().slice(0,7); let iso=ymDia(ym,+m[1]);
    if(iso>todayISO()) iso=ymDia(ymAdd(ym,-1),+m[1]); data=iso;
  }
  cut(/\shoje\s/);

  // meio de pagamento
  let meio=null;
  if(cut(/\s(?:no\s+|via\s+|pelo\s+|de\s+)?pix\s/)) meio='pix';
  else if(cut(/\s(?:no\s+|na\s+)?(?:cartao\s+(?:de\s+)?)?credito\s/)) meio='credito';
  else if(cut(/\s(?:no\s+|na\s+)?(?:cartao\s+(?:de\s+)?)?debito\s/)) meio='debito';
  else if(cut(/\s(?:em\s+|no\s+)?(?:dinheiro|especie)\s/)) meio='dinheiro';

  // cartão pelo nome ("no nubank", "no inter")
  let cartao='';
  for(const c of fin.cartoes){
    const n=finNorm(c.nome).replace(/[^a-z0-9\s]/g,' ').trim(); if(!n) continue;
    if(cut(new RegExp('\\s(?:no\\s+|na\\s+|do\\s+|da\\s+|pelo\\s+)?(?:cartao\\s+(?:do\\s+|da\\s+)?)?'+escRe(n).replace(/\s+/g,'\\s+')+'\\s'))){cartao=c.id; if(!meio)meio='credito'; break;}
  }
  if(!meio&&cut(/\s(?:no\s+|na\s+)?cartao\s/)) meio='credito';
  if(!meio&&(parc>1||falouParcelado)) meio='credito';
  if(!meio){meio='pix'; flags.push('Não ouvi a forma de pagamento — assumi Pix.');}
  if(meio==='credito'){
    if(!cartao){
      if(fin.cartoes.length===1) cartao=fin.cartoes[0].id;
      else if(fin.cartoes.length>1){ cartao=fin.cfg.cartaoPadrao||fin.cartoes[0].id;
        flags.push('Não ouvi qual cartão — usei '+(fin.cartoes.find(c=>c.id===cartao)||{}).nome+'.'); }
      else flags.push('Nenhum cartão cadastrado — cadastre na aba Cartões para a fatura ser calculada.');
    }
  }else{ parc=1; cartao=''; }

  // valor
  let valor=0;
  const cents=x=>x?(+x)/100:0;
  if(m=cut(/\srs\s*([\d.,]*\d)(?:\s+e\s+(\d{1,2})\s+centavos?)?\s/)) valor=parseBRL(m[1])+cents(m[2]);
  else if(m=cut(/\s([\d.,]*\d)\s+(?:reais|real|contos?|pilas?)(?:\s+e\s+(\d{1,2})(?:\s+centavos?)?)?\s/)) valor=parseBRL(m[1])+cents(m[2]);
  else if(m=cut(/\s(\d+)\s+e\s+(\d{2})\s/)) valor=+m[1]+cents(m[2]);          // "dezoito e cinquenta"
  else if(m=cut(/\s(\d{1,2})\s+centavos?\s/)) valor=cents(m[1]);
  else if(m=cut(/\s([\d.,]*\d)\s/)) valor=parseBRL(m[1]);
  valor=r2(valor);
  if(!valor) flags.push('Não entendi o valor.');

  // descrição: o que sobrou, com a grafia original ("iFood", "açaí")
  const orig={}; String(raw).split(/\s+/).forEach(w=>{const clean=w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
    const k=finNorm(clean).replace(/[^a-z0-9]/g,''); if(k&&!orig[k]) orig[k]=clean;});
  let words=t.trim().split(/\s+/).filter(w=>w&&!FIN_VERBOS.has(w)&&w!=='rs');
  while(words.length&&FIN_STOP.has(words[0])) words.shift();
  while(words.length&&FIN_STOP.has(words[words.length-1])) words.pop();
  let desc=words.map(w=>orig[w]||w).join(' ').trim();
  if(!desc){ desc='Gasto'; flags.push('Não identifiquei a descrição.'); }
  else if(desc.split(' ')[0]===desc.split(' ')[0].toLowerCase()) desc=desc[0].toUpperCase()+desc.slice(1); // preserva “iFood”

  const {cat,fonte}=finCategorizar(finNorm(desc));
  if(cat==='outros') flags.push('Não reconheci a categoria — escolha abaixo e eu aprendo para as próximas.');
  return {valor,desc,cat,catSug:cat,fonte,meio,cartao,parc,data,fala:String(raw).trim(),flags,origem:origem||'voz'};
}

/* ---------------- voz: reconhecimento + leitura em voz alta ---------------- */
export const FIN_SR=(typeof window!=='undefined')&&(window.SpeechRecognition||window.webkitSpeechRecognition);
export let finRec=null;
export const FIN_VOZ={p:null,editId:null,fat0:''};
export function finEscutar({onInterim,onFinal,onErro}){
  if(!FIN_SR) return false;
  finPararEscuta();
  const r=new FIN_SR(); r.lang='pt-BR'; r.interimResults=true; r.continuous=false; r.maxAlternatives=1;
  let final='';
  r.onresult=e=>{let it='';for(let i=e.resultIndex;i<e.results.length;i++){const s=e.results[i][0].transcript;
    if(e.results[i].isFinal) final+=s+' '; else it+=s;} onInterim&&onInterim((final+it).trim());};
  r.onerror=e=>{ onErro&&onErro(e.error); };
  r.onend=()=>{ if(finRec===r) finRec=null; onFinal&&onFinal(final.trim()); };
  try{ r.start(); }catch(e){ return false; }
  finRec=r; return true;
}
export function finPararEscuta(){ if(finRec){const r=finRec; finRec=null; try{r.onend=null;r.onresult=null;r.abort();}catch(e){}} }
export function finFalar(txt,cb){
  try{
    if(!('speechSynthesis' in window)){cb&&cb();return;}
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(txt); u.lang='pt-BR'; u.rate=1.08;
    const v=speechSynthesis.getVoices().find(v=>/pt[-_]BR/i.test(v.lang)); if(v) u.voice=v;
    let done=false; const fim=()=>{if(!done){done=true;cb&&cb();}};
    u.onend=fim; u.onerror=fim; setTimeout(fim,9000);   // alguns Androids nunca disparam onend
    speechSynthesis.speak(u);
  }catch(e){cb&&cb();}
}
export function finFrase(p){
  const r=Math.floor(p.valor), c=Math.round((p.valor-r)*100);
  const v=(r?r+(r===1?' real':' reais'):'')+(c?(r?' e ':'')+c+' centavos':'');
  const dia=p.data===todayISO()?'':p.data===addDaysISO(todayISO(),-1)?', ontem':', dia '+(+p.data.slice(8,10));
  const cart=p.meio==='credito'&&p.cartao?' '+((fin.cartoes.find(x=>x.id===p.cartao)||{}).nome||''):'';
  return `Entendi: ${v||'valor não identificado'}, ${p.desc}, ${finCat(p.cat).nome}, no ${FIN_MEIOS[p.meio]}${cart}${p.parc>1?' em '+p.parc+' vezes':''}${dia}. Confirma?`;
}
export function finVozFechar(){ finPararEscuta(); try{speechSynthesis.cancel();}catch(e){} FIN_VOZ.p=null; FIN_VOZ.editId=null; closeModal(); }

export function finVozAbrir(){
  finPararEscuta(); try{speechSynthesis.cancel();}catch(e){}
  FIN_VOZ.p=null; FIN_VOZ.editId=null;
  modal(`<h3>Registrar gasto</h3>
    <div class="fin-mic-wrap">
      <button class="fin-mic" id="finMic" onclick="finMicToggle()" aria-label="Microfone">🎙</button>
      <div class="fin-live" id="finLive">${FIN_SR?'Toque e fale: <b>“32 reais no iFood no pix”</b>':'Este navegador não tem reconhecimento de voz. Use o microfone do teclado no campo abaixo — o resultado passa pelo mesmo interpretador.'}</div>
    </div>
    <div class="field"><label>Ou dite pelo teclado / digite</label>
      <input id="finTxt" placeholder="Ex: 89,90 farmácia no crédito em 3x" onkeydown="if(event.key==='Enter')finProcessar(this.value,'texto')"></div>
    <div class="fin-ex">“gastei 45 no mercado no débito” · “uber 18 e 50 no pix” · “tênis 600 reais no nubank em 4 vezes” · “ontem 30 de açaí no dinheiro”</div>
    <div class="modal-actions"><button class="btn line" onclick="finVozFechar()">Cancelar</button>
      <button class="btn line" onclick="finNovoManual()">Formulário</button>
      <button class="btn" onclick="finProcessar(finVal('finTxt'),'texto')">Interpretar</button></div>`);
  if(FIN_SR) finMicToggle();
}
export function finMicToggle(){
  const mic=document.getElementById('finMic'), live=document.getElementById('finLive');
  if(finRec){ try{finRec.stop();}catch(e){} return; }   // stop → onend → processa o que ouviu
  const ok=finEscutar({
    onInterim:txt=>{ if(live) live.innerHTML='“'+h(txt)+'”'; },
    onFinal:txt=>{ if(mic) mic.classList.remove('on');
      if(!document.getElementById('finMic')) return;
      if(txt) finProcessar(txt,'voz'); else if(live) live.innerHTML='Não ouvi nada — toque no microfone de novo.'; },
    onErro:err=>{ if(!live) return;
      live.innerHTML=err==='not-allowed'||err==='service-not-allowed'?'Permissão de microfone negada — libere nas configurações do site.'
        :err==='network'?'O reconhecimento do Chrome precisa de internet. Use o campo abaixo.'
        :err==='no-speech'?'Não ouvi nada — toque no microfone de novo.':'Falha no microfone ('+h(err)+').'; }
  });
  if(ok){ mic&&mic.classList.add('on'); live&&(live.innerHTML='Ouvindo…'); }
}
export function finProcessar(txt,origem){
  txt=String(txt||'').trim(); if(!txt){toast('Fale ou digite o gasto');return;}
  finPararEscuta(); finConfirmar(finParse(txt,origem));
}
export function finNovoManual(){
  finPararEscuta();
  finConfirmar({valor:0,desc:'',cat:'outros',catSug:'outros',meio:'pix',cartao:fin.cfg.cartaoPadrao||'',parc:1,data:todayISO(),fala:'',flags:[],origem:'manual'});
}
export function finGastoEditar(id){
  const g=fin.gastos.find(x=>x.id===id); if(!g) return;
  finConfirmar({...g,catSug:g.cat,flags:[],origem:'edit',fala:g.fala||''},id);
}
export function finMeioChange(){ const cr=document.getElementById('fgCred'); if(cr) cr.style.display=finVal('fgM')==='credito'?'':'none'; }

export function finConfirmar(p,editId){
  FIN_VOZ.p=p; FIN_VOZ.editId=editId||null;
  const cartaoSel=p.cartao||fin.cfg.cartaoPadrao||(fin.cartoes[0]||{}).id||'';
  FIN_VOZ.fat0=cartaoSel?(p.fatIni||finFaturaDaCompra(cartaoSel,p.data)):'';
  const dup=!editId&&p.valor&&fin.gastos.find(g=>g.data===p.data&&g.valor===p.valor&&finNorm(g.desc)===finNorm(p.desc));
  const titulo=editId?'Editar gasto':p.origem==='manual'?'Novo gasto':'Confere?';
  modal(`<h3>${titulo}</h3>
    ${p.fala&&!editId?`<div class="fin-heard">Ouvi: “${h(p.fala)}”</div>`:''}
    ${p.origem==='voz'||p.origem==='texto'?`<div class="fin-sum">${h(finFrase(p).replace(/ Confirma\?$/,''))}</div>`:''}
    ${(p.flags||[]).map(f=>`<div class="fin-flag">⚠ ${h(f)}</div>`).join('')}
    ${p.parcIni>1?`<div class="fin-flag" style="background:var(--blue-soft);color:var(--blue)">Importada da fatura a partir da parcela ${p.parcIni}/${p.parc} — as anteriores foram pagas antes do app. O valor é o total da compra.</div>`:''}
    ${dup?`<div class="fin-flag">⚠ Já existe “${h(dup.desc)}” de ${brl(dup.valor)} nesta data — confira se não é duplicado.</div>`:''}
    <div class="grid2">
      <div class="field"><label>Valor (R$)</label><input id="fgV" inputmode="decimal" value="${p.valor?p.valor.toFixed(2).replace('.',','):''}"></div>
      <div class="field"><label>Data da compra</label><input type="date" id="fgDt" value="${p.data}"></div>
    </div>
    <div class="field"><label>Descrição</label><input id="fgD" value="${h(p.desc)}" placeholder="Ex: iFood"></div>
    <div class="grid2">
      <div class="field"><label>Categoria ${p.fonte==='aprendido'?'<span class="pill green">aprendida</span>':''}</label>
        <select id="fgC">${FIN_CATS.map(c=>`<option value="${c.id}" ${c.id===p.cat?'selected':''}>${c.nome}</option>`).join('')}</select></div>
      <div class="field"><label>Pagamento</label>
        <select id="fgM" onchange="finMeioChange()">${Object.entries(FIN_MEIOS).map(([k,v])=>`<option value="${k}" ${k===p.meio?'selected':''}>${v}</option>`).join('')}</select></div>
    </div>
    <div id="fgCred" style="${p.meio==='credito'?'':'display:none'}">
      <div class="grid2">
        <div class="field"><label>Cartão</label><select id="fgK">${fin.cartoes.length
          ?fin.cartoes.map(c=>`<option value="${c.id}" ${c.id===cartaoSel?'selected':''}>${h(c.nome)}</option>`).join('')
          :'<option value="">— cadastre um cartão —</option>'}</select></div>
        <div class="field"><label>Parcelas</label><input type="number" id="fgP" min="1" max="48" value="${p.parc||1}"></div>
      </div>
      <div class="field"><label>1ª fatura (vencimento) — calculada pelo fechamento</label><input type="month" id="fgF" value="${FIN_VOZ.fat0}"></div>
    </div>
    <div class="fin-sn" id="finSN"></div>
    <div class="modal-actions">
      ${editId?`<button class="btn line" onclick="finVozFechar()">Cancelar</button>`
              :`<button class="btn line" onclick="finVozAbrir()">🎙 De novo</button>`}
      <button class="btn" onclick="finSalvarGasto()">${editId?'Salvar':'Confirmar'}</button></div>`);
  if(p.origem==='voz'){
    finFalar(finFrase(p),()=>{ if(fin.cfg.vozConfirma&&FIN_SR&&FIN_VOZ.p===p&&document.getElementById('finSN')) finOuvirSimNao(); });
  }
}
export function finOuvirSimNao(){
  const el=document.getElementById('finSN'); if(!el) return;
  el.innerHTML='🎙 Diga <b>“sim”</b> para salvar ou <b>“não”</b> para corrigir';
  const ok=finEscutar({
    onFinal:txt=>{
      const box=document.getElementById('finSN'); if(!box) return;
      const n=' '+finNorm(txt).replace(/[^a-z\s]/g,' ')+' ';
      if(/\s(sim|confirma|confirmo|isso|pode|ok|okay|certo|correto|salva|salvar|beleza|perfeito)\s/.test(n)&&!/\snao\s/.test(n)) finSalvarGasto();
      else if(/\s(nao|cancela|errado|corrige|corrigir)\s/.test(n)) box.innerHTML='Ok — corrija os campos e toque em Confirmar.';
      else box.innerHTML=txt?`Não entendi “${h(txt)}” — toque em Confirmar ou corrija.`:'Sem resposta — toque em Confirmar quando estiver certo.';
    },
    onErro:()=>{ const box=document.getElementById('finSN'); if(box) box.innerHTML=''; }
  });
  if(!ok) el.innerHTML='';
}
export function finSalvarGasto(){
  finPararEscuta(); try{speechSynthesis.cancel();}catch(e){}
  const v=parseBRL(finVal('fgV')); if(!(v>0)){toast('Informe o valor');return;}
  const meio=finVal('fgM'); const cred=meio==='credito';
  const cartao=cred?finVal('fgK'):'';
  if(cred&&!cartao){toast('Cadastre um cartão na aba Cartões primeiro');return;}
  const parc=cred?Math.min(48,Math.max(1,parseInt(finVal('fgP'))||1)):1;
  const desc=finVal('fgD').trim()||'Gasto', cat=finVal('fgC'), data=finVal('fgDt')||todayISO();
  const p=FIN_VOZ.p||{};
  if(cat!==p.catSug) finAprender(desc,cat);
  const dados={data,desc,valor:v,cat,meio,cartao,parc};
  // 1ª fatura: só grava override se você mexeu no campo; senão segue a regra do fechamento
  const fatCampo=cred?finVal('fgF'):'';
  const fatIni=cred&&fatCampo&&fatCampo!==FIN_VOZ.fat0?fatCampo:(cred&&p.fatIni&&fatCampo===FIN_VOZ.fat0&&p.data===data&&p.cartao===cartao?p.fatIni:'');
  let g;
  if(FIN_VOZ.editId){ g=fin.gastos.find(x=>x.id===FIN_VOZ.editId); if(g){Object.assign(g,dados); if(fatIni)g.fatIni=fatIni; else delete g.fatIni;} }
  else{ g={id:uid(),...dados,fala:p.fala||'',origem:p.origem||'manual',criado:Date.now()}; if(fatIni)g.fatIni=fatIni; fin.gastos.push(g); }
  const edit=!!FIN_VOZ.editId;
  FIN_VOZ.p=null; FIN_VOZ.editId=null;
  finSave(); closeModal(); if(current==='financas') vFinancas();
  toast(`${edit?'Atualizado':'Salvo'} · ${brl(v)} · ${finCat(cat).nome}${parc>1?' · '+parc+'x':''}`);
}
export function finGastoDel(id){const g=fin.gastos.find(x=>x.id===id); if(!g)return;
  if(!confirm(`Excluir “${g.desc}” (${brl(g.valor)})?${g.parc>1?'\nTodas as '+g.parc+' parcelas saem das faturas.':''}`))return;
  fin.gastos=fin.gastos.filter(x=>x.id!==id); finSave(); vFinancas(); toast('Gasto excluído');}
