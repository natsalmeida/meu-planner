// core/horas.js — gerado a partir do monólito; edite aqui a partir de agora.
import { areaById } from './constantes.js';
import { store } from './store.js';
import { durH, localISO, monthKey, todayISO, weekKey } from './datas.js';
import { anoAtual } from '../views/analytics/graficos.js';

/* ---------------- Study hours (TRE excluded) ---------------- */
export function countableLogs(){return store.logs.filter(l=>areaById(l.area).conta);}

/* ---- Trabalho (TRE em casa): agregados paralelos, jamais somados ao estudo ---- */
export function workLogs(){return store.logs.filter(l=>!areaById(l.area).conta);}
export function workHoursRange(iniISO,fimISO){
  return workLogs().filter(l=>l.data>=iniISO&&l.data<=fimISO).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function workHoursWeek(wk){wk=wk||weekKey(todayISO());
  return workLogs().filter(l=>weekKey(l.data)===wk).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function workHoursMonth(mk){mk=mk||monthKey(todayISO());
  return workLogs().filter(l=>monthKey(l.data)===mk).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function workHoursYear(y){y=String(y||anoAtual());
  return workLogs().filter(l=>String(l.data).startsWith(y)).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function workHoursOnDay(iso){
  return workLogs().filter(l=>l.data===iso).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
// segunda-feira da semana de `iso` (semana ISO, igual ao weekKey)
export function inicioSemanaISO(iso){const d=new Date((iso||todayISO())+'T12:00');
  d.setDate(d.getDate()-((d.getDay()+6)%7)); return localISO(d);}
export function hoursBy(fn){const m={};countableLogs().forEach(l=>{const k=fn(l);m[k]=(m[k]||0)+durH(l.ini,l.fim);});return m;}
export function hoursThisWeek(){const wk=weekKey(todayISO());return countableLogs().filter(l=>weekKey(l.data)===wk).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function hoursThisWeekByArea(areaId){const wk=weekKey(todayISO());
  return countableLogs().filter(l=>l.area===areaId&&weekKey(l.data)===wk).reduce((s,l)=>s+durH(l.ini,l.fim),0);}
export function studyStreak(){
  // dias consecutivos (terminando hoje ou ontem) com ao menos uma sessão que conta
  const dias=new Set(countableLogs().map(l=>l.data));
  if(!dias.size)return 0;
  let streak=0; const d=new Date();
  // se não estudou hoje ainda, começa a contar de ontem para não zerar durante o dia
  if(!dias.has(d.toISOString().slice(0,10))) d.setDate(d.getDate()-1);
  while(dias.has(d.toISOString().slice(0,10))){streak++; d.setDate(d.getDate()-1);}
  return streak;
}
export function isAtrasado(prazo,done){if(!prazo||done)return false;return prazo<todayISO();}
