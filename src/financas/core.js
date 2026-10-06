// financas/core.js — gerado a partir do monólito; edite aqui a partir de agora.
import { db } from '../core/firebase.js';
import { __set_pendingRerender, authReady, isPlainObj } from '../core/store.js';
import { setSync, syncErrHandler } from '../core/sync-status.js';
import { authUser } from '../core/auth.js';
import { uid } from '../core/app.js';
import { todayISO } from '../core/datas.js';
import { h, toast } from '../ui/base.js';
import { current } from '../ui/router.js';
import { finCompDe, r2 } from './util.js';
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
  fin.cartoes.forEach(c=>{ if(!c.id)c.id=uid(); c.fecha=Math.min(31,Math.max(1,parseInt(c.fecha)||1));
    c.vence=Math.min(31,Math.max(1,parseInt(c.vence)||10)); c.limite=r2(c.limite); });
}
finRebuildCats();
export function finMirror(){ try{ localStorage.setItem(FIN_LS,JSON.stringify(fin)); }catch(e){} }
export function finHydrate(){ try{ const raw=localStorage.getItem(FIN_LS); if(raw){ const d=JSON.parse(raw); if(isPlainObj(d)){Object.assign(fin,d);} } }catch(e){} finNormalize(); }
export function finTemDados(){ return fin.contas.length||fin.gastos.length||fin.cartoes.length||fin.modelos.length; }

export let finLastPushed='', finAttached=false;
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
export function finForcarEnvio(){ if(!authReady){toast('Entre com o Google primeiro');return;} finSave(); toast('Enviando finanças…'); }
export function finSave(){
  finNormalize(); finMirror();
  if(authReady){
    finLastPushed=JSON.stringify(fin);
    setSync('salvando');
    db.ref(FIN_ROOT).set(JSON.parse(finLastPushed))
      .then(()=>{ setSync('ok',''); finSetSync('ok'); })
      .catch(err=>{ syncErrHandler(err,'finSave falhou'); finErrSync(err); toast('Finanças: NÃO subiu para a nuvem — veja o aviso na aba'); });
  }else{ setSync('local','autenticação indisponível — nada sobe para a nuvem'); finSetSync('local'); }
}
export function attachFinSync(){
  if(finAttached) return; finAttached=true;
  finSetSync('conectando');
  db.ref(FIN_ROOT).on('value',snap=>{
    finSetSync('ok');
    const d=snap.val();
    if(d==null){ if(finTemDados()) finSave(); return; }   // nuvem vazia: sobe o que existe local
    if(!isPlainObj(d)) return;
    const inc=JSON.stringify(d);
    if(inc===finLastPushed||inc===JSON.stringify(fin)) return;
    Object.assign(fin,d); finNormalize(); finMirror();
    if(current==='financas'){ if(document.querySelector('.modal-bg')) __set_pendingRerender(true); else vFinancas(); }
  },err=>{
    syncErrHandler(err,'Sync financeiro falhou'); finErrSync(err); finAttached=false;
    if(String(err&&err.code||'').includes('permission')) toast('Finanças: atualize as regras do Firebase (Saúde dos dados)');
  });
}
export function detachFinSync(){ try{ db.ref(FIN_ROOT).off(); }catch(e){} finAttached=false; finSetSync('local'); }
