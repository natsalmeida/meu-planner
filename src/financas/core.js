// financas/core.js — gerado a partir do monólito; edite aqui a partir de agora.
import { db } from '../core/firebase.js';
import { __set_pendingRerender, authReady, isPlainObj } from '../core/store.js';
import { setSync, syncErrHandler } from '../core/sync-status.js';
import { canonStr, diffFlat } from '../core/sync.js';
import { authUser } from '../core/auth.js';
import { uid } from '../core/app.js';
import { todayISO } from '../core/datas.js';
import { h, toast } from '../ui/base.js';
import { current } from '../ui/router.js';
import { finCompDe, finNorm, r2 } from './util.js';
import { FIN_TIPOS, vFinancas } from './view.js';

/* ======================================================================
   FINANÇAS
   Nó PRÓPRIO no Firebase (meu_financeiro), fora do `store`. Motivo:
   save() faz set() do store inteiro em meu_planner — um filho aninhado ali
   seria sobrescrito a cada gravação de estudo, e cada gasto registrado
   inflaria o payload do planner (que o Diagnóstico já vigia).
   ====================================================================== */
export const FIN_ROOT='meu_financeiro';
export const FIN_LS='planner_fin_v1';
export const FIN_MEIOS={pix:'Pix',credito:'Crédito',debito:'Débito',dinheiro:'Dinheiro'};
/* Categorias fixas. As criadas pelo usuário ficam em fin.catsExtra (sincronizadas)
   e são mescladas aqui por finRebuildCats(); 'outros' fica sempre por último. */
export const FIN_CATS_BASE=[
  {id:'alimentacao',nome:'Alimentação',cor:'#ba7517',kw:['ifood','ifd','rappi','ze delivery','mcdonalds','burger king','subway','restaurante','lanche','lanchonete','padaria','pizza','pizzaria','hamburguer','burger','acai','sorvete','cafe','almoco','janta','jantar','marmita','marmitex','comida','salgado','pastel','churrasco','delivery','espetinho','sushi','doce','bolo']},
  {id:'mercado',nome:'Mercado',cor:'#1d9e75',kw:['mercado','supermercado','carrefour','pao de acucar','sams club','mateus','atacadao','assai','feira','hortifruti','acougue','verdurao','quitanda']},
  {id:'transporte',nome:'Transporte',cor:'#378add',kw:['uber','99app','99pop','shell','ipiranga','petrobras','auto posto','taxi','onibus','gasolina','combustivel','posto','etanol','alcool','estacionamento','pedagio','passagem','mecanico','oficina','pneu','oleo','lava jato']},
  {id:'saude',nome:'Saúde',cor:'#e24b4a',kw:['drogasil','raia','pague menos','panvel','farmacia','remedio','remedios','drogaria','consulta','medico','dentista','exame','exames','academia','plano de saude','psicologo','terapia','suplemento','whey']},
  {id:'educacao',nome:'Educação',cor:'#7c3aed',kw:['livro','livros','livraria','curso','faculdade','unitins','apostila','xerox','impressao','udemy','alura','busuu','kultivi','caderno']},
  {id:'moradia',nome:'Casa',cor:'#6d6879',kw:['conta de celular','plano de celular','telefone','aluguel','condominio','luz','energia','agua','internet','gas','botijao','limpeza','reforma','moveis','utensilio','utensilios']},
  {id:'lazer',nome:'Lazer',cor:'#db5c88',kw:['cinema','show','bar','cerveja','balada','viagem','hotel','ingresso','jogo','festa','passeio','boteco']},
  {id:'assinaturas',nome:'Assinaturas',cor:'#0e8a9b',kw:['netflix','spotify','youtube','prime video','amazon prime','disney','chatgpt','claude','icloud','google one','assinatura','notion','deezer','globoplay','hbo','apple','openai','anthropic','adobe','canva','microsoft']},
  {id:'compras',nome:'Compras',cor:'#b3589a',kw:['mercadolivre','mercadolibre','magazine','americanas','casas bahia','renner','riachuelo','centauro','netshoes','kabum','aliexpress','temu','roupa','roupas','sapato','tenis','shopee','amazon','mercado livre','shein','magalu','loja','presente','eletronico','celular','fone','notebook','computador','blusa','calca','vestido']},
  {id:'cuidados',nome:'Cuidados pessoais',cor:'#8a6d3b',kw:['salao','cabelo','manicure','unha','unhas','barbeiro','cosmetico','cosmeticos','perfume','maquiagem','depilacao','skincare']},
  {id:'pets',nome:'Pets',cor:'#5f8f3e',kw:['racao','veterinario','petshop','pet shop','areia']},
  {id:'financiamentos',nome:'Financiamentos',cor:'#c2410c',kw:['financiamento','emprestimo','consorcio','terreno','prestacao']},
  {id:'impostos',nome:'Impostos e taxas',cor:'#475569',kw:['ipva','iptu','imposto','darf','licenciamento','multa','anuidade','iof','tarifa','juros','encargos']},
  {id:'familia',nome:'Família',cor:'#be185d',kw:['mamae','papai','mae','pai','ajuda','mesada','pensao','vovo','avo']},
  {id:'servicos',nome:'Serviços',cor:'#0f766e',kw:['diarista','faxina','faxineira','personal','jardineiro','manutencao','conserto','lavanderia','costureira']},
  {id:'outros',nome:'Outros',cor:'#9b96a7',kw:[]},
];
/* FIN_CATS e FIN_KW são mutados no lugar (nunca reatribuídos): os outros módulos
   importam a referência, e um binding importado não pode ser trocado. */
export const FIN_CATS=[];
export const FIN_KW=[];
export const finCatById=id=>FIN_CATS.find(c=>c.id===id);
export const finCat=id=>finCatById(id)||finCatById('outros');
export const FIN_CAT_PALETA=['#2563eb','#16a34a','#d97706','#9333ea','#dc2626','#0891b2','#65a30d','#c026d3','#ea580c','#4f46e5','#0d9488','#be123c'];
export function finRebuildCats(){
  const extra=(fin.catsExtra||[]).filter(c=>!FIN_CATS_BASE.some(b=>b.id===c.id));
  FIN_CATS.length=0;
  FIN_CATS.push(...FIN_CATS_BASE.filter(c=>c.id!=='outros'),...extra,FIN_CATS_BASE.find(c=>c.id==='outros'));
  // palavras-chave mais longas primeiro: "mercado livre" tem que vencer "mercado"
  FIN_KW.length=0;
  FIN_KW.push(...FIN_CATS.flatMap(c=>(c.kw||[]).map(k=>[k,c.id])).sort((a,b)=>b[0].length-a[0].length));
}

export const fin={version:1,contas:[],modelos:[],gastos:[],cartoes:[],faturasPagas:{},faturasValor:{},aprendido:{},catsExtra:[],cfg:{diaVirada:10,vozConfirma:true,cartaoPadrao:''}};

/* ---- Estornos ----
   Crédito/estorno na fatura vem como valor NEGATIVO. Ele tem que abater a categoria da
   compra que foi estornada (hotel cancelado reduz Hospedagem), não cair em "Outros".
   Procura a compra positiva mais provável: palavras em comum na descrição (sem os termos
   de estorno), mesmo cartão e data anterior; valor igual reforça. */
const EST_STOP=new Set(['estorno','est','estornado','cancelamento','cancelado','cancel','canc','credito','cred','devolucao','devol','reembolso','ajuste','compra','parc','parcela','de','do','da','em','no','na']);
const estTokens=s=>finNorm(s).replace(/[^a-z0-9]+/g,' ').split(' ').filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!EST_STOP.has(t));
export function finCatEstorno(desc,valor,data,cartao,ignorarId){
  const tk=estTokens(desc); if(!tk.length) return null;
  let melhor=null, nota=0;
  fin.gastos.forEach(g=>{
    if(g.id===ignorarId||!(g.valor>0)||(data&&g.data>data)) return;
    if(cartao&&g.cartao&&g.cartao!==cartao) return;
    const gt=new Set(estTokens(g.desc)); if(!gt.size) return;
    const comuns=tk.filter(t=>gt.has(t)).length; if(!comuns) return;
    let s=comuns/Math.min(tk.length,gt.size);
    if(Math.abs(Math.abs(valor)-g.valor)<=0.02) s+=0.5;
    if(s>nota||(s===nota&&melhor&&g.data>melhor.data)){ nota=s; melhor=g; }
  });
  return nota>=0.5?melhor:null;
}
export function finEhEstorno(g){ return g.valor<0; }

export function finNormalize(){
  // RTDB devolve array esparso como objeto e omite array vazio
  ['contas','modelos','gastos','cartoes'].forEach(k=>{
    if(!Array.isArray(fin[k])) fin[k]=isPlainObj(fin[k])?Object.values(fin[k]):[];
    fin[k]=fin[k].filter(isPlainObj);
  });
  ['faturasPagas','faturasValor','aprendido'].forEach(k=>{ if(!isPlainObj(fin[k])) fin[k]={}; });
  if(!Array.isArray(fin.catsExtra)) fin.catsExtra=isPlainObj(fin.catsExtra)?Object.values(fin.catsExtra):[];
  fin.catsExtra=fin.catsExtra.filter(c=>isPlainObj(c)&&c.id&&String(c.nome||'').trim()).map(c=>({id:String(c.id),nome:String(c.nome).trim(),
    cor:/^#[0-9a-f]{6}$/i.test(c.cor||'')?c.cor:'#9b96a7',kw:(Array.isArray(c.kw)?c.kw:Object.values(c.kw||{})).map(String).filter(Boolean)}));
  finRebuildCats();   // ANTES da checagem dos gastos; senão gasto de categoria criada vira Outros
  if(!isPlainObj(fin.cfg)) fin.cfg={};
  const dv=parseInt(fin.cfg.diaVirada); fin.cfg.diaVirada=isFinite(dv)?Math.min(28,Math.max(0,dv)):10;
  if(fin.cfg.vozConfirma===undefined) fin.cfg.vozConfirma=true;
  if(!fin.cartoes.some(c=>c.id===fin.cfg.cartaoPadrao)) fin.cfg.cartaoPadrao='';
  fin.contas.forEach(c=>{ if(!c.id)c.id=uid(); c.valor=r2(c.valor); c.ok=!!c.ok;
    if(!FIN_TIPOS[c.tipo])c.tipo='despesa'; if(typeof c.venc!=='string')c.venc='';
    if(!c.ok||c.tipo==='receita'||!/^\d{4}-\d{2}$/.test(c.pagoComp||'')||c.pagoComp>=c.comp) delete c.pagoComp; if(!/^\d{4}-\d{2}$/.test(c.comp||''))c.comp=finCompDe(c.venc||todayISO()); });
  fin.modelos.forEach(m=>{ if(!m.id)m.id=uid(); m.valor=r2(m.valor); m.dia=Math.min(31,Math.max(0,parseInt(m.dia)||0));
    if(!FIN_TIPOS[m.tipo])m.tipo='despesa'; m.mesSeguinte=!!m.mesSeguinte; });
  fin.gastos.forEach(g=>{ if(!g.id)g.id=uid(); g.valor=r2(g.valor); g.parc=Math.min(48,Math.max(1,parseInt(g.parc)||1));
    if(!FIN_MEIOS[g.meio])g.meio='pix'; if(!finCatById(g.cat))g.cat='outros'; if(!g.data)g.data=todayISO();
    if(g.meio!=='credito'){g.parc=1;g.cartao='';delete g.fatIni;} if(g.parc<2||!(g.parcIni>1)) delete g.parcIni; });
  // migração única: estornos antigos que a importação jogou em "Outros"
  if(!fin.cfg.migEstornos){
    fin.gastos.forEach(g=>{ if(g.valor<0&&g.cat==='outros'){ const m=finCatEstorno(g.desc,g.valor,g.data,g.cartao,g.id); if(m) g.cat=m.cat; } });
    fin.cfg.migEstornos=1;
  }
  fin.cartoes.forEach(c=>{ if(!c.id)c.id=uid(); c.fecha=Math.min(31,Math.max(1,parseInt(c.fecha)||1));
    c.vence=Math.min(31,Math.max(1,parseInt(c.vence)||10)); c.limite=r2(c.limite); });
}
finRebuildCats();
export function finMirror(){ try{ localStorage.setItem(FIN_LS,JSON.stringify(fin)); }catch(e){} }
export function finHydrate(){ try{ const raw=localStorage.getItem(FIN_LS); if(raw){ const d=JSON.parse(raw); if(isPlainObj(d)){Object.assign(fin,d);} } }catch(e){} finNormalize(); }
export function finTemDados(){ return fin.contas.length||fin.gastos.length||fin.cartoes.length||fin.modelos.length; }

export let finAttached=false;
export const FIN_SYNC={estado:'conectando',erro:'',ultimo:0};
export function finSetSync(estado,erro){
  FIN_SYNC.estado=estado; FIN_SYNC.erro=erro||''; if(estado==='ok') FIN_SYNC.ultimo=Date.now();
  const el=document.getElementById('finSyncBox'); if(el) el.outerHTML=finSyncBox();
}
export function finErrSync(err){
  const code=String((err&&(err.code||err.message))||'erro desconhecido');
  if(code.includes('permission')||code.includes('PERMISSION')) finSetSync('bloqueado',code);
  else if(typeof navigator!=='undefined'&&navigator.onLine===false) finSetSync('offline','sem rede');
  else finSetSync('erro',code);
}
export function finSyncBox(){
  const st=FIN_SYNC.estado, conta=authUser?(authUser.email?authUser.email+' · UID '+authUser.uid.slice(0,6)+'…':authUser.uid):'';
  const map={
    ok:['green','● Finanças sincronizadas',`conta ${conta}`],
    conectando:['gray','○ Conectando finanças…',conta?`conta ${conta}`:''],
    offline:['amber','▲ Sem rede','as mudanças sobem quando a conexão voltar'],
    local:['amber','▲ Finanças só neste aparelho','você não está logada — entre com o Google para sincronizar'],
    bloqueado:['red','■ Firebase bloqueando as finanças',`a regra do nó meu_financeiro não existe ou não tem o UID desta conta (${conta})`],
    erro:['red','■ Falha ao sincronizar finanças',FIN_SYNC.erro],
  };
  const [cor,tit,det]=map[st]||map.conectando;
  const acao=st==='bloqueado'?`<button class="btn sm" onclick="mDiagnostico()">Ver regra</button>`
            :st==='erro'||st==='ok'?`<button class="btn sm line" onclick="finForcarEnvio()">Enviar agora</button>`:'';
  return `<div id="finSyncBox" class="fin-sync ${cor}"><div><b>${tit}</b><small>${h(det)}</small></div>${acao}</div>`;
}
/* ======================================================================
   SYNC GRANULAR DAS FINANÇAS (schema remoto 2) — mesmo desenho do sync dos estudos:
   cada entidade é um nó (meu_financeiro/gastos/{id}); finSave() envia só o diff contra
   a SOMBRA (último estado confirmado da nuvem) num update() multi-caminho. A sombra
   fica no aparelho, então lançamento feito offline (mesmo com a aba fechada) entra
   por cima da nuvem quando a conexão volta, em vez de ser sobrescrito por ela.
   ====================================================================== */
export const FIN_SCHEMA=2;
const FIN_SHADOW_KEY='planner_fin_shadow_v1';
const FIN_ARR=['contas','modelos','gastos','cartoes','catsExtra'];
const FIN_MAP=['faturasPagas','faturasValor','aprendido'];
let finShadow=null, finPronto=false;
// chave do Firebase não aceita . # $ [ ] / — palavra aprendida pode ter; % codifica % também (ida e volta exata)
const encK=k=>String(k).replace(/[.#$\[\]\/%]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0'));
const decK=k=>String(k).replace(/%([0-9A-F]{2})/g,(_,x)=>String.fromCharCode(parseInt(x,16)));

export function finFlatten(o){
  const f={}, put=(k,v)=>{const j=canonStr(v); if(j!==undefined)f[k]=j;};
  Object.keys(o).forEach(k=>{
    if(k==='_schema'||k==='_ordem') return;
    const v=o[k];
    if(FIN_ARR.includes(k)){
      (Array.isArray(v)?v:[]).forEach(x=>{ if(x&&x.id!=null) put(k+'/'+encK(x.id),x); });
      if(k!=='gastos') put('_ordem/'+k,(v||[]).map(x=>x&&x.id).filter(x=>x!=null).map(encK));
    }else if(FIN_MAP.includes(k)){
      Object.keys(v||{}).forEach(m=>put(k+'/'+encK(m),v[m]));
    }else put(k,v);
  });
  f._schema=String(FIN_SCHEMA);
  return f;
}
/* nó remoto (schema 2 ou legado gravado inteiro) -> {caminho: JSON} */
export function finRemoteFlat(d){
  if(d&&d._schema===FIN_SCHEMA){
    const f={}, put=(k,v)=>{const j=canonStr(v); if(j!==undefined)f[k]=j;};
    Object.keys(d).forEach(k=>{
      const v=d[k];
      if(FIN_ARR.includes(k)&&isPlainObj(v)) Object.keys(v).forEach(id=>{ if(isPlainObj(v[id])) put(k+'/'+id,{...v[id],id:decK(id)}); });
      else if(FIN_MAP.includes(k)&&isPlainObj(v)) Object.keys(v).forEach(m=>put(k+'/'+m,v[m]));
      else if(k==='_ordem'&&isPlainObj(v)) Object.keys(v).forEach(c=>put('_ordem/'+c,Object.values(v[c]||{})));
      else if(k==='_schema') f._schema=String(v);
      else put(k,v);
    });
    return f;
  }
  // legado: arrays (o RTDB pode devolver array esparso como objeto)
  const o={...d}; FIN_ARR.forEach(k=>{ if(isPlainObj(o[k])) o[k]=Object.values(o[k]); });
  const f=finFlatten(o); delete f._schema; return f;
}
export function finUnflatten(f){
  const o={}, cols={}, maps={}, ordem={};
  FIN_ARR.forEach(c=>cols[c]={}); FIN_MAP.forEach(m=>maps[m]={});
  Object.keys(f).forEach(k=>{
    const i=k.indexOf('/'), top=i<0?k:k.slice(0,i), sub=i<0?null:k.slice(i+1), v=JSON.parse(f[k]);
    if(top==='_schema') return;
    if(sub!=null&&cols[top]) cols[top][sub]=v;
    else if(sub!=null&&maps[top]) maps[top][decK(sub)]=v;
    else if(top==='_ordem'&&sub!=null) ordem[sub]=v;
    else o[top]=v;
  });
  FIN_ARR.forEach(c=>{
    const m=cols[c], out=[], usados=new Set();
    (ordem[c]||[]).forEach(id=>{ if(m[id]&&!usados.has(id)){ out.push(m[id]); usados.add(id); } });
    Object.keys(m).sort().forEach(id=>{ if(!usados.has(id)) out.push(m[id]); });
    o[c]=out;
  });
  FIN_MAP.forEach(mp=>o[mp]=maps[mp]);
  return o;
}
function finFlatToTree(f){
  const t={};
  Object.keys(f).forEach(k=>{
    const i=k.indexOf('/'), v=JSON.parse(f[k]);
    if(i<0){ t[k]=v; return; }
    const top=k.slice(0,i); (t[top]=t[top]||{})[k.slice(i+1)]=v;
  });
  t._schema=FIN_SCHEMA; return t;
}
function finPatch(p){ const u={}; Object.keys(p).forEach(k=>{ u[k]=p[k]==null?null:JSON.parse(p[k]); }); if('_schema' in u) u._schema=FIN_SCHEMA; return u; }
function finPersistShadow(){ try{ if(finShadow) localStorage.setItem(FIN_SHADOW_KEY,JSON.stringify(finShadow)); else localStorage.removeItem(FIN_SHADOW_KEY); }catch(e){} }
function finLoadShadow(){ try{ const r=localStorage.getItem(FIN_SHADOW_KEY); finShadow=r?JSON.parse(r):null; }catch(e){ finShadow=null; } }
function finAplicar(o){
  // zera o que pode ter sido apagado em outro aparelho antes de aplicar o estado mesclado
  Object.assign(fin,{contas:[],modelos:[],gastos:[],cartoes:[],catsExtra:[],faturasPagas:{},faturasValor:{},aprendido:{}},o);
  finNormalize(); finMirror();
  if(current==='financas'){ if(document.querySelector('.modal-bg')) __set_pendingRerender(true); else vFinancas(); }
}

/* "Enviar agora": reenvia tudo o que existe neste aparelho (não apaga nada na nuvem) */
export function finForcarEnvio(){
  if(!authReady){toast('Entre com o Google primeiro');return;}
  if(!finPronto){toast('Ainda conectando às finanças…');return;}
  const f=finFlatten(fin);
  db.ref(FIN_ROOT).update(finPatch(f)).then(()=>{ finShadow={...finShadow,...f}; finPersistShadow(); finSetSync('ok'); toast('Finanças enviadas'); })
    .catch(err=>{ syncErrHandler(err,'finForcarEnvio falhou'); finErrSync(err); });
}
export function finSave(){
  finNormalize(); finMirror();
  if(!authReady){ setSync('local','autenticação indisponível — nada sobe para a nuvem'); finSetSync('local'); return; }
  if(!finPronto){ finSetSync('conectando'); return; }        // o merge do 1º snapshot leva esta edição
  const atual=finFlatten(fin), patch=diffFlat(finShadow,atual), chaves=Object.keys(patch);
  if(!chaves.length){ finSetSync('ok'); return; }
  const antes={}; chaves.forEach(k=>{ antes[k]=finShadow?finShadow[k]:undefined; });
  finShadow=atual; finPersistShadow();
  setSync('salvando');
  db.ref(FIN_ROOT).update(finPatch(patch))
    .then(()=>{ setSync('ok',''); finSetSync('ok'); })
    .catch(err=>{
      chaves.forEach(k=>{ if(antes[k]===undefined) delete finShadow[k]; else finShadow[k]=antes[k]; });
      finPersistShadow();
      syncErrHandler(err,'finSave falhou'); finErrSync(err); toast('Finanças: NÃO subiu para a nuvem — veja o aviso na aba');
    });
}
export function attachFinSync(){
  if(finAttached) return; finAttached=true;
  finLoadShadow();
  finSetSync('conectando');
  db.ref(FIN_ROOT).on('value',snap=>{
    const d=snap.val();
    if(d!=null&&!isPlainObj(d)) return;
    const legado=d==null||d._schema!==FIN_SCHEMA;
    const remoto=d==null?{}:finRemoteFlat(d);
    const local=finFlatten(fin);
    // edições locais ainda não confirmadas pela nuvem. Sem sombra (1º uso deste aparelho
    // no formato novo) e nuvem legada: o local entra inteiro, como fazia o set() antigo.
    const pendente=finShadow?diffFlat(finShadow,local):(legado?local:{});
    delete pendente._schema;
    const merged={...remoto};
    Object.keys(pendente).forEach(k=>{ if(pendente[k]==null) delete merged[k]; else merged[k]=pendente[k]; });
    const primeiro=!finPronto;
    if(Object.keys(diffFlat(local,merged)).filter(k=>k!=='_schema').length) finAplicar(finUnflatten(merged));
    if(legado){
      if(d==null&&!finTemDados()){ finShadow={}; finPersistShadow(); finPronto=true; finSetSync('ok'); return; }
      const f=finFlatten(fin);
      setSync('salvando');
      db.ref(FIN_ROOT).set(finFlatToTree(f))
        .then(()=>{ finShadow=f; finPersistShadow(); finPronto=true; setSync('ok',''); finSetSync('ok'); })
        .catch(err=>{ syncErrHandler(err,'migração das finanças falhou'); finErrSync(err); });
      return;
    }
    finShadow=remoto; finPersistShadow(); finPronto=true;
    const n=Object.keys(pendente).filter(k=>!k.startsWith('_ordem/')).length;
    if(Object.keys(pendente).length){ finSave(); if(primeiro&&n) toast('Finanças: '+n+(n===1?' alteração feita offline enviada':' alterações feitas offline enviadas')); }
    else finSetSync('ok');
  },err=>{
    syncErrHandler(err,'Sync financeiro falhou'); finErrSync(err); finAttached=false;
    if(String(err&&err.code||'').includes('permission')) toast('Finanças: atualize as regras do Firebase (Saúde dos dados)');
  });
}
export function detachFinSync(){ try{ db.ref(FIN_ROOT).off(); }catch(e){} finAttached=false; finPronto=false; finSetSync('local'); }
