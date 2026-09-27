// core/store.js — gerado a partir do monólito; edite aqui a partir de agora.
import { DEFAULT_GRADE, DEFAULT_HABITOS, DEFAULT_PERIODOS } from './constantes.js';
import { periodoAtivo } from './periodos.js';
import { uid } from './app.js';
import { todayISO } from './datas.js';
import { materiaStatusAuto } from '../views/unitins/hub.js';
import { invalidateHabitCache } from '../views/habitos/habitos.js';

export const store = {
  version: 4,
  logs:[], pendencias:[], materias:[], aulas:[], entregaveis:[], sincronas:[],
  livros:[],  // { id, titulo, autor, paginas, mes:'YYYY-MM' } — estante ligada ao hábito de leitura
  checkins:[], // { id, area, mes:'YYYY-MM', nivel:'B1+', fonte:'auto'|'teste', obs } — nível por idioma, 1 por mês
  seeds:{},    // migrações de conteúdo que rodam uma vez só (sobrevivem a o usuário desfazer)
  periodos: DEFAULT_PERIODOS.map(p=>({...p})),
  grade: DEFAULT_GRADE.map(g=>({...g})),
  habitos: DEFAULT_HABITOS.map(x=>({...x})),
  habitLog: {}, // { 'YYYY-MM-DD': { habitId: true } } — grava só o que foi feito
  metaSemanal: 20,
  metasArea: {}, 
  tema: 'claro',
};
export const SCHEMA_VERSION = 4;
export const ROOT = 'meu_planner';       // caminho preservado (mantém seu histórico)
export const LS_KEY = 'planner_store_v1';

export let authReady = false;            // true quando há sessão anônima
export let syncAttached = false;
export let pendingRerender = false;      // re-render adiado enquanto um modal está aberto

/* ---- validação de shape (protege contra import/registro corrompido) ---- */
export function isPlainObj(o){return o&&typeof o==='object'&&!Array.isArray(o);}
export function validateStore(d){
  if(!isPlainObj(d)) return false;
  const arrays=['logs','pendencias','materias','aulas','entregaveis','sincronas','grade','habitos','periodos','livros','checkins'];
  for(const k of arrays){ if(k in d && !Array.isArray(d[k])) return false; }
  const objs=['habitLog','metasArea'];
  for(const k of objs){ if(k in d && !isPlainObj(d[k])) return false; }
  if('metaSemanal' in d && typeof d.metaSemanal!=='number' && d.metaSemanal!=null) return false;
  return true;
}
/* ---- normaliza defaults/migrações num só lugar ---- */
export function normalizeStore(){
  ['logs','pendencias','materias','aulas','entregaveis','sincronas','livros','checkins'].forEach(k=>{ if(!Array.isArray(store[k])) store[k]=[]; });
  if(!isPlainObj(store.seeds)) store.seeds={};
  if(!Array.isArray(store.periodos)||!store.periodos.length) store.periodos=DEFAULT_PERIODOS.map(p=>({...p}));
  store.periodos.forEach(p=>{ if(!p.id)p.id=uid(); if(!p.nome)p.nome='Período'; });
  store.periodos.sort((a,b)=>String(a.ini).localeCompare(String(b.ini)));
  if(!Array.isArray(store.grade)||!store.grade.length) store.grade=DEFAULT_GRADE.map(g=>({...g}));
  if(!Array.isArray(store.habitos)) store.habitos=DEFAULT_HABITOS.map(x=>({...x}));
  if(!isPlainObj(store.habitLog)) store.habitLog={};
  // vínculo com período letivo (migração: tudo que é órfão vai para o período vigente)
  {const pa=periodoAtivo(), pid=pa?pa.id:'';
   store.grade.forEach(g=>{ if(!g.periodo) g.periodo=pid; });
   store.materias.forEach(m=>{ if(!m.periodo) m.periodo=pid; });}
  if(store.metaSemanal==null) store.metaSemanal=20;
  if(!isPlainObj(store.metasArea)) store.metasArea={};
  if(!store.tema) store.tema='claro';
  // seed único: se o "Estudo" já existe sem exclusões definidas, aplica os microdrills padrão
  const est=Array.isArray(store.habitos)?store.habitos.find(x=>x.id==='h_estudo'):null;
  if(est&&est.auto&&est.excluir===undefined) est.excluir=['Inglês Busuu','Espanhol Busuu','Espanhol Drops'];
  // migração de hábitos: frequência-alvo e limiar do automático
  store.habitos.forEach(hb=>{
    if(!hb.freq) hb.freq='diario';                       // preserva o comportamento anterior
    if(hb.freq==='semanal'&&!hb.alvo) hb.alvo=3;
    if(hb.freq==='dias'&&!Array.isArray(hb.dias)) hb.dias=[1,3,5];
    if(!Array.isArray(hb.dias)) hb.dias=[];
    if(hb.auto&&hb.minMin===undefined) hb.minMin=60;     // sem limiar o auto marca todo dia e não informa nada
    if(!hb.auto) hb.minMin=0;
    // A estante é um FLAG do hábito, não um id fixo: se o "Leitura" for renomeado
    // ou excluído, os livros não viram órfãos e qualquer outro hábito pode adotá-los.
    if(hb.id==='h_leitura'&&hb.livros===undefined) hb.livros=true;
    hb.livros=!!hb.livros;
  });
  store.livros.forEach(lv=>{ if(!lv.id)lv.id=uid(); lv.paginas=Math.max(0,+lv.paginas||0);
    if(!/^\d{4}-\d{2}$/.test(String(lv.mes||''))) lv.mes=todayISO().slice(0,7); });
  invalidateHabitCache();
  /* Entregáveis: "Atrasado" era um status MANUAL competindo com o cálculo por prazo —
     dois donos da mesma verdade. Dava para ter item vencido marcado "A fazer" e item
     no prazo marcado "Atrasado". Agora o atraso é sempre derivado da data e o status
     guarda só a intenção. A migração preserva o que era: atrasado = não entregue. */
  store.entregaveis.forEach(e=>{
    if(e.status==='Atrasado') e.status='A fazer';
    if(!e.status) e.status='A fazer';
    if(e.prazo==null) e.prazo='';
  });
  // matérias: status automático derivado das aulas, salvo quando travado manualmente
  store.materias.forEach(m=>{
    if(m.statusManual===undefined) m.statusManual=false;
    if(!m.statusManual){ const auto=materiaStatusAuto(m.id); if(auto) m.status=auto; }
  });
  /* Semeaduras únicas. Guardadas em store.seeds (não inferidas do dado) para que desfazer
     à mão seja respeitado: sem a marca, o split do Poliglota voltaria a cada carregamento. */
  if(!store.seeds.poliglota){
    (store.grade||[]).forEach(g=>{ if(/poliglota/i.test(g.atividade||'')&&!g.split) g.split={ingles:50,espanhol:50}; });
    store.seeds.poliglota=true;
  }
  if(!store.seeds.saida){
    const RX=/\bfala\b|encontro|poliglota/i;
    (store.grade||[]).forEach(g=>{ if(RX.test(g.atividade||'')) g.saida=true; });
    store.logs.forEach(l=>{ if(RX.test(l.atividade||'')) l.saida=true; });
    store.seeds.saida=true;
  }
  store.version=SCHEMA_VERSION;
}
/* aplica um objeto de dados vindo do Firebase ou do localStorage */
export function applyData(d){
  if(!validateStore(d)) return false;
  Object.assign(store, d);
  normalizeStore();
  return true;
}

export function mirrorLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(store)); }catch(e){} }
export function hydrateLocal(){
  try{ const raw=localStorage.getItem(LS_KEY);
    if(raw){ const d=JSON.parse(raw); if(applyData(d)) return true; } }catch(e){}
  return false;
}


/* setters: outros módulos não podem reatribuir um binding importado */
export function __set_syncAttached(v){ syncAttached=v; return v; }
export function __set_pendingRerender(v){ pendingRerender=v; return v; }
export function __set_authReady(v){ authReady=v; return v; }
