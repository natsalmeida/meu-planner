// core/sync.js — gerado a partir do monólito; edite aqui a partir de agora.
import { db } from './firebase.js';
import { ROOT, __set_pendingRerender, __set_syncAttached, applyData, authReady, isPlainObj, mirrorLocal, normalizeStore, store, syncAttached } from './store.js';
import { setSync, syncErrHandler } from './sync-status.js';
import { aplicarTema } from './app.js';
import { renderTimerWidget } from '../features/timer.js';
import { toast } from '../ui/base.js';
import { renderCurrent, renderNav } from '../ui/router.js';

/* ======================================================================
   SYNC GRANULAR (schema remoto 5)
   Em memória nada muda: as coleções continuam arrays e as 400+ funções do app
   seguem iguais. Só a persistência mudou:
   • No Firebase cada entidade é um nó próprio: meu_planner/logs/{id}.
   • save() compara o estado atual com a SOMBRA (último estado confirmado da
     nuvem) e envia só o que mudou num update() multi-caminho. Acabou o set()
     da árvore inteira, que fazia o último aparelho a salvar apagar o que os
     outros tinham feito.
   • A sombra fica persistida no aparelho. Edições feitas offline, mesmo com a
     aba fechada, viram um patch aplicado por cima da nuvem quando a conexão
     volta: merge de 3 vias por entidade (base = sombra, local, remoto).
     Conflito na MESMA entidade: vence a edição local.
   ====================================================================== */
export const SYNC_SCHEMA=5;
export const SHADOW_KEY='planner_shadow_v1';
export const SYNC_COLS=['logs','pendencias','materias','aulas','entregaveis','sincronas','livros','periodos','grade','habitos','checkins'];
export const SYNC_ORDEM=SYNC_COLS.filter(c=>c!=='logs'); // logs são reordenados por data; o resto preserva a ordem de inserção
export let shadow=null;         // {caminho: JSON canônico} do que a nuvem tem
export let syncPronto=false;    // só grava depois do 1º snapshot (antes disso não sabemos o formato remoto)

/* JSON canônico: chaves ordenadas e sem vazios, espelhando o que o Firebase guarda
   (ele descarta null, [] e {} e devolve as chaves em ordem). Sem isso, toda entidade
   com `dias:[]` ou chaves em outra ordem pareceria "alterada" e seria regravada sempre. */
export function canon(v){
  if(v===undefined||v===null) return undefined;
  if(Array.isArray(v)){ const a=v.map(canon).filter(x=>x!==undefined); return a.length?a:undefined; }
  if(typeof v==='object'){ const o={}; Object.keys(v).sort().forEach(k=>{const c=canon(v[k]); if(c!==undefined)o[k]=c;});
    return Object.keys(o).length?o:undefined; }
  if(typeof v==='number'&&!isFinite(v)) return undefined;
  return v;
}
export function canonStr(v){ const c=canon(v); return c===undefined?undefined:JSON.stringify(c); }
export const KEY_OK=k=>typeof k==='string'&&k.length>0&&!/[.#$\[\]\/]/.test(k);

/* store (arrays) -> {caminho: JSON} */
export function flatten(st){
  const f={};
  const put=(k,v)=>{const j=canonStr(v); if(j!==undefined)f[k]=j;};
  Object.keys(st).forEach(k=>{
    if(k==='_schema') return;
    const v=st[k];
    if(SYNC_COLS.includes(k)){
      (Array.isArray(v)?v:[]).forEach(o=>{ if(o&&KEY_OK(o.id)) put(k+'/'+o.id,o); });
      if(SYNC_ORDEM.includes(k)) put('_ordem/'+k,(v||[]).map(o=>o&&o.id).filter(KEY_OK));
    }else if(k==='habitLog'){
      Object.keys(v||{}).forEach(d=>{ if(KEY_OK(d)) put('habitLog/'+d,v[d]); });
    }else put(k,v);
  });
  f._schema=String(SYNC_SCHEMA);
  return f;
}
/* nó remoto (schema 5 ou legado com arrays) -> {caminho: JSON} */
export function remoteFlat(d){
  const f={};
  const put=(k,v)=>{const j=canonStr(v); if(j!==undefined)f[k]=j;};
  Object.keys(d||{}).forEach(k=>{
    const v=d[k];
    if(SYNC_COLS.includes(k)){
      if(Array.isArray(v)){                                                             // legado
        v.forEach(o=>{ if(o&&KEY_OK(o.id)) put(k+'/'+o.id,o); });
        if(SYNC_ORDEM.includes(k)&&!f['_ordem/'+k]) put('_ordem/'+k,v.map(o=>o&&o.id).filter(KEY_OK)); // a ordem do array vira _ordem
      }
      else if(isPlainObj(v)) Object.keys(v).forEach(id=>{ if(isPlainObj(v[id])) put(k+'/'+id,{...v[id],id}); });
    }else if(k==='habitLog'&&isPlainObj(v)){
      Object.keys(v).forEach(dt=>put('habitLog/'+dt,v[dt]));
    }else if(k==='_ordem'&&isPlainObj(v)){
      Object.keys(v).forEach(c=>put('_ordem/'+c,Object.values(v[c]||{})));
    }else if(k==='_schema'){ f._schema=String(v); }
    else put(k,v);
  });
  return f;
}
/* {caminho: JSON} -> store com arrays (o formato que o app inteiro usa) */
export function unflatten(f){
  const d={habitLog:{}}, cols={}, ordem={};
  SYNC_COLS.forEach(c=>cols[c]={});
  Object.keys(f).forEach(k=>{
    const i=k.indexOf('/'), top=i<0?k:k.slice(0,i), sub=i<0?null:k.slice(i+1), v=JSON.parse(f[k]);
    if(top==='_schema') return;
    if(sub!=null&&cols[top]) cols[top][sub]=v;
    else if(top==='habitLog'&&sub!=null) d.habitLog[sub]=v;
    else if(top==='_ordem'&&sub!=null) ordem[sub]=v;
    else d[top]=v;
  });
  SYNC_COLS.forEach(c=>{
    const m=cols[c], out=[], usados=new Set();
    (ordem[c]||[]).forEach(id=>{ if(m[id]&&!usados.has(id)){ out.push(m[id]); usados.add(id); } });
    Object.keys(m).sort().forEach(id=>{ if(!usados.has(id)) out.push(m[id]); });
    if(c==='logs') out.sort((a,b)=>String(a.data+a.ini).localeCompare(String(b.data+b.ini)));
    d[c]=out;
  });
  if(!isPlainObj(d.metasArea)) d.metasArea={};
  return d;
}
/* {caminho: JSON} -> árvore aninhada para o set() da migração */
export function flatToTree(f){
  const t={};
  Object.keys(f).forEach(k=>{
    const i=k.indexOf('/'), v=JSON.parse(f[k]);
    if(i<0){ t[k]=v; return; }
    const top=k.slice(0,i); (t[top]=t[top]||{})[k.slice(i+1)]=v;
  });
  t._schema=SYNC_SCHEMA;
  return t;
}
export function diffFlat(base,atual){
  const p={}; base=base||{};
  Object.keys(atual).forEach(k=>{ if(base[k]!==atual[k]) p[k]=atual[k]; });
  Object.keys(base).forEach(k=>{ if(!(k in atual)) p[k]=null; });
  return p;
}
export function patchParaFirebase(p){
  const u={}; Object.keys(p).forEach(k=>{ u[k]=p[k]==null?null:JSON.parse(p[k]); });
  if('_schema' in u) u._schema=SYNC_SCHEMA;
  return u;
}
export function persistShadow(){ try{ if(shadow) localStorage.setItem(SHADOW_KEY,JSON.stringify(shadow)); else localStorage.removeItem(SHADOW_KEY); }catch(e){} }
export function loadShadow(){ try{ const r=localStorage.getItem(SHADOW_KEY); shadow=r?JSON.parse(r):null; }catch(e){ shadow=null; } }

/* save principal: espelha local sempre; envia à nuvem só o diff contra a sombra */
export function save(){
  normalizeStore();
  mirrorLocal();
  if(!authReady){ setSync('local','autenticação indisponível — nada sobe para a nuvem'); return; }
  if(!syncPronto){ setSync('conectando',''); return; }   // o merge do 1º snapshot leva esta edição
  const atual=flatten(store), patch=diffFlat(shadow,atual), chaves=Object.keys(patch);
  if(!chaves.length){ setSync('ok',''); return; }
  const antes={}; chaves.forEach(k=>{ antes[k]=shadow?shadow[k]:undefined; });
  shadow=atual; persistShadow();
  setSync('salvando');
  db.ref(ROOT).update(patchParaFirebase(patch))
    .then(()=>setSync('ok',''))
    .catch(err=>{
      // gravação recusada (regra/validação): devolve a sombra para a próxima tentativa reenviar
      chaves.forEach(k=>{ if(antes[k]===undefined) delete shadow[k]; else shadow[k]=antes[k]; });
      persistShadow();
      syncErrHandler(err,'save falhou'); toast('Falha ao sincronizar — salvo localmente');
    });
}
/* mantido por compatibilidade: o diff já grava só o dia alterado */
export function saveHabitDay(){ save(); }

/* ---- Auth com Google + sincronização ao vivo ----
   Login anônimo foi removido: qualquer pessoa cria uma conta anônima em milissegundos,
   então a regra `auth != null` não protegia nada num repositório público. Com Google
   o UID é estável em todos os aparelhos, e a regra pode ser fixada nele de uma vez. */

export function attachSync(){
  if(syncAttached) return; __set_syncAttached(true);
  loadShadow();
  db.ref(ROOT).on('value', snap=>{
    const d=snap.val();
    if(d==null){                                     // banco vazio: sobe o estado atual
      const f=flatten(store);
      db.ref(ROOT).set(flatToTree(f)).then(()=>{ shadow=f; persistShadow(); syncPronto=true; setSync('ok',''); })
        .catch(err=>syncErrHandler(err,'carga inicial falhou'));
      return;
    }
    /* Legado = árvore com arrays e sem _schema: a 1ª carga depois do deploy, ou uma aba
       antiga que gravou por cima antes de a regra nova travar. Entra no merge igual a
       qualquer snapshot e depois a árvore é regravada inteira no formato 5. */
    const legado=d._schema!==SYNC_SCHEMA;
    const remoto=remoteFlat(d);
    const local=flatten(store);
    // edições locais ainda não confirmadas pela nuvem (offline, aba fechada, 1º segundo do app)
    const pendente=shadow?diffFlat(shadow,local):{};
    delete pendente._schema;
    const merged={...remoto};
    Object.keys(pendente).forEach(k=>{ if(pendente[k]==null) delete merged[k]; else merged[k]=pendente[k]; });
    const primeiro=!syncPronto;
    if(Object.keys(diffFlat(local,merged)).filter(k=>k!=='_schema').length){
      if(!applyData(unflatten(merged))) return;
      mirrorLocal();
      if(document.querySelector('.modal-bg')){ __set_pendingRerender(true); }  // não destrói modal aberto
      else { aplicarTema(); renderNav(); renderCurrent(); renderTimerWidget(); }
    }
    if(legado){
      const f=flatten(store);
      setSync('salvando');
      db.ref(ROOT).set(flatToTree(f))
        .then(()=>{ shadow=f; persistShadow(); syncPronto=true; setSync('ok','');
          if(primeiro) toast('Sincronização granular ativada'); })
        .catch(err=>syncErrHandler(err,'migração falhou'));
      return;
    }
    shadow=remoto; persistShadow(); syncPronto=true;
    const n=Object.keys(pendente).filter(k=>!k.startsWith('_ordem/')).length;
    if(Object.keys(pendente).length){ save(); if(primeiro&&n) toast(n+(n===1?' alteração feita offline enviada':' alterações feitas offline enviadas')); }
    else setSync('ok','');
  }, err=>{
    syncErrHandler(err,'Sync falhou');
    if((err.code||'').includes('permission')) toast('Regras do Firebase bloqueando — confira as rules');
  });
}


/* setters: outros módulos não podem reatribuir um binding importado */
export function __set_syncPronto(v){ syncPronto=v; return v; }
