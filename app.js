// core/app.js — gerado a partir do monólito; edite aqui a partir de agora.
import { hydrateLocal, normalizeStore, store } from './store.js';
import { save } from './sync.js';
import { initAuth } from './auth.js';
import { checkDeadlineAlerts } from '../features/prazos.js';
import { current, go, renderNav } from '../ui/router.js';
import { finHydrate } from '../financas/core.js';
import { finAvisos } from '../financas/config.js';

export function load(){
  hydrateLocal();          // pinta a UI instantaneamente (funciona offline)
  normalizeStore();        // idempotente; garante semeaduras também na 1ª carga sem espelho local
  finHydrate();            // finanças: nó e espelho local próprios
  aplicarTema();
  renderNav();
  go('dashboard');
  initAuth();              // conecta o Firebase e passa a sincronizar ao vivo
  setTimeout(checkDeadlineAlerts, 1200);
  setTimeout(finAvisos, 1500);
}

export function aplicarTema(){document.documentElement.setAttribute('data-tema',store.tema||'claro');}

export function toggleTema(){ 
  store.tema=(store.tema==='escuro')?'claro':'escuro'; 
  save(); 
  aplicarTema(); 
  renderNav(); 
  go(current); 
}
export const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
