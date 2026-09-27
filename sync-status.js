// core/sync-status.js — gerado a partir do monólito; edite aqui a partir de agora.
import { h } from '../ui/base.js';

/* ---- Estado de sincronização visível ----
   Falha de sync é silenciosa por natureza: o app continua funcionando contra o
   localStorage e o toast some em segundos. Sem indicador permanente, dá para
   passar semanas achando que está sincronizado quando não está. */
export const SYNC_ST={estado:'conectando',erro:'',ultimo:0,tick:null};
export const SYNC_INFO={
  ok:        {cor:'var(--green)', ic:'●', txt:'sincronizado'},
  salvando:  {cor:'var(--blue)',  ic:'◐', txt:'salvando…'},
  conectando:{cor:'var(--faint)', ic:'○', txt:'conectando…'},
  offline:   {cor:'var(--amber)', ic:'▲', txt:'sem rede'},
  local:     {cor:'var(--amber)', ic:'▲', txt:'só neste aparelho'},
  bloqueado: {cor:'var(--red)',   ic:'■', txt:'acesso negado'},
  erro:      {cor:'var(--red)',   ic:'■', txt:'falha ao salvar'}
};
export function setSync(estado,erro){
  SYNC_ST.estado=estado;
  if(erro!==undefined)SYNC_ST.erro=erro||'';
  if(estado==='ok')SYNC_ST.ultimo=Date.now();
  renderSyncBadge();
}
export function syncHaQuanto(){
  if(!SYNC_ST.ultimo)return '';
  const s=Math.floor((Date.now()-SYNC_ST.ultimo)/1000);
  if(s<60)return 'agora mesmo';
  if(s<3600)return 'há '+Math.floor(s/60)+'min';
  if(s<86400)return 'há '+Math.floor(s/3600)+'h';
  return 'há '+Math.floor(s/86400)+'d';
}
export function renderSyncBadge(){
  const el=document.getElementById('syncBadge'); if(!el)return;
  const i=SYNC_INFO[SYNC_ST.estado]||SYNC_INFO.conectando;
  const det=SYNC_ST.estado==='ok'?syncHaQuanto():(SYNC_ST.erro||'toque para detalhes');
  el.innerHTML=`<span class="sb-dot" style="color:${i.cor}">${i.ic}</span>
    <span class="sb-txt"><b style="color:${i.cor}">${i.txt}</b><small>${h(det)}</small></span>`;
  el.title='Status da sincronização — toque para diagnóstico';
  if(!SYNC_ST.tick)SYNC_ST.tick=setInterval(()=>{if(SYNC_ST.estado==='ok')renderSyncBadge();},30000);
}
if(typeof window!=='undefined'){
  window.addEventListener('online', ()=>{ if(SYNC_ST.estado==='offline')setSync('conectando',''); });
  window.addEventListener('offline',()=>setSync('offline','sem conexão de rede'));
}
export function syncErrHandler(err,ctx){
  const code=(err&&(err.code||err.message))||'erro desconhecido';
  console.error(ctx,code);
  if(String(code).includes('permission')){
    setSync('bloqueado','regras do Firebase negando — confira Realtime Database → Regras');
  }else if(typeof navigator!=='undefined'&&navigator.onLine===false){
    setSync('offline','sem conexão de rede');
  }else{
    setSync('erro',String(code));
  }
}
