// ui/base.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, areaById } from '../core/constantes.js';
import { __set_pendingRerender, pendingRerender } from '../core/store.js';
import { aplicarTema } from '../core/app.js';
import { renderCurrent, renderNav } from './router.js';
import { finPararEscuta } from '../financas/voz.js';

/* ---------------- UI helpers ---------------- */
export function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1900);}
export function modal(html){document.getElementById('modalRoot').innerHTML=
  `<div class="modal-bg"><div class="modal">${html}</div></div>`;}
export function closeModal(){if(typeof finPararEscuta==='function'){finPararEscuta();try{speechSynthesis.cancel();}catch(e){}}document.getElementById('modalRoot').innerHTML='';
  if(pendingRerender){__set_pendingRerender(false);aplicarTema();renderNav();renderCurrent();}}
export function h(s){return(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
export function areaOptions(sel,includeTre=true){return AREAS.filter(a=>includeTre||a.conta)
  .map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${a.nome}</option>`).join('');}
export function areaPill(id){const a=areaById(id);return `<span class="pill" style="background:${a.cor}22;color:${a.cor}">${h(a.nome)}</span>`;}
