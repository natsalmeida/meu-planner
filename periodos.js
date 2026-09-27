// core/periodos.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from './store.js';
import { fmtBR, todayISO } from './datas.js';

export function periodoById(id){return store.periodos.find(p=>p.id===id)||null;}
export function periodoDe(iso){return store.periodos.find(p=>iso>=p.ini&&iso<=p.fim)||null;}
export function periodoAtivo(){
  return periodoDe(todayISO())
      || [...store.periodos].sort((a,b)=>b.fim.localeCompare(a.fim))[0]
      || null;
}
export function periodoLabel(p){return p?`${p.nome} · ${fmtBR(p.ini).slice(0,5)}–${fmtBR(p.fim).slice(0,5)}`:'—';}
export function periodoEncerrado(p){return !!(p&&p.fim<todayISO());}
