// ui/router.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../core/store.js';
import { vDashboard } from '../views/dashboard.js';
import { vCalendario } from '../views/calendario.js';
import { vPendencias } from '../views/pendencias.js';
import { vDiarios } from '../views/diario.js';
import { vGrade } from '../views/grade.js';
import { vUnitins } from '../views/unitins/hub.js';
import { vAnalytics } from '../views/analytics/analytics.js';
import { vHabitos } from '../views/habitos/habitos.js';
import { vFinancas } from '../financas/view.js';

/* ---------------- Router ---------------- */
export const NAV=[
  {g:'Principal'},
  {id:'dashboard',ic:'▦',nome:'Dashboard'},
  {id:'calendario',ic:'▤',nome:'Calendário'},
  {id:'pendencias',ic:'◔',nome:'Pendências'},
  {id:'habitos',ic:'✓',nome:'Hábitos'},
  {id:'financas',ic:'◎',nome:'Finanças'},
  {g:'Estudos'},
  {id:'diarios',ic:'✎',nome:'Diários de Bordo'},
  {id:'grade',ic:'▥',nome:'Grade Semanal'},
  {id:'unitins',ic:'◈',nome:'Hub UNITINS'},
  {id:'analytics',ic:'◑',nome:'Analytics'},
];
export let current='dashboard';
export function renderNav(){
  document.getElementById('nav').innerHTML=NAV.map(n=>{
    if(n.g)return `<div class="nav-group">${n.g}</div>`;
    return `<button class="nav-item ${n.id===current?'active':''}" onclick="go('${n.id}')">
      <span class="ic">${n.ic}</span>${n.nome}${n.id===current?'<span class="dot"></span>':''}</button>`;
  }).join('');
  const esc=store.tema==='escuro';
  const il=document.getElementById('temaIc'),ll=document.getElementById('temaLbl');
  if(il)il.textContent=esc?'☀':'◐'; if(ll)ll.textContent=esc?'Modo claro':'Modo escuro';
}
export function toggleSidebar(force){
  const sb=document.querySelector('.sidebar'), ov=document.querySelector('.sidebar-overlay');
  const openNow = force!==undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open',openNow); ov.classList.toggle('show',openNow);
}
export const VIEWS={dashboard:vDashboard,calendario:vCalendario,pendencias:vPendencias,
  habitos:vHabitos,diarios:vDiarios,grade:vGrade,unitins:vUnitins,analytics:vAnalytics,financas:vFinancas};
export function renderCurrent(){ (VIEWS[current]||vDashboard)(); } // re-render sem scroll/side-effects
export function go(id){current=id;renderNav();toggleSidebar(false);
  window.scrollTo(0,0);(VIEWS[id]||vDashboard)();}
