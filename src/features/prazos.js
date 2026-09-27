// features/prazos.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../core/store.js';
import { fmtBR, todayISO } from '../core/datas.js';
import { toast } from '../ui/base.js';
import { materiaNome } from '../views/unitins/hub.js';

/* ---------------- Alertas de prazo ---------------- */
export function daysUntil(iso){return Math.ceil((new Date(iso+'T00:00')-new Date(todayISO()+'T00:00'))/86400000);}
export function upcomingDeadlines(){
  const out=[];
  store.entregaveis.forEach(e=>{ if(e.status==='Entregue'||!e.prazo)return; const d=daysUntil(e.prazo);
    if(d<=3) out.push({tipo:'Entregável',id:'e'+e.id,nome:e.nome,prazo:e.prazo,d,mat:materiaNome(e.materia)}); });
  store.pendencias.forEach(p=>{ if(p.done||!p.prazo)return; const d=daysUntil(p.prazo);
    if(d<=3) out.push({tipo:'Pendência',id:'p'+p.id,nome:p.nome,prazo:p.prazo,d}); });
  store.sincronas.forEach(s=>{ if(!s.data)return; const d=daysUntil(s.data);
    if(d>=0&&d<=3) out.push({tipo:'Aula síncrona',id:'s'+s.id,nome:s.nome+(s.ini?' · '+s.ini:''),prazo:s.data,d,
      label:d===0?('hoje às '+(s.ini||'—')):d===1?('amanhã às '+(s.ini||'—')):('em '+d+' dias às '+(s.ini||'—'))}); });
  return out.sort((a,b)=>a.d-b.d);
}
export function labelPrazo(d){return d<0?`atrasado ${-d}d`:d===0?'vence hoje':d===1?'vence amanhã':`vence em ${d} dias`;}
export function checkDeadlineAlerts(){
  const items=upcomingDeadlines();
  if(!items.length) return;
  if(typeof Notification==='undefined'||Notification.permission!=='granted') return;
  const key='planner_notified_'+todayISO();
  let already={}; try{already=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
  const novos=items.filter(it=>!already[it.id]);
  novos.slice(0,5).forEach(it=>{
    try{ new Notification('📌 '+it.nome,{body:`${it.tipo} · ${it.label||labelPrazo(it.d)} (${fmtBR(it.prazo)})`}); }catch(e){}
    already[it.id]=1;
  });
  try{localStorage.setItem(key,JSON.stringify(already));}catch(e){}
}
export function enableNotifs(){
  if(typeof Notification==='undefined'){toast('Este navegador não suporta notificações');return;}
  if(Notification.permission==='granted'){toast('Avisos já estão ativos');checkDeadlineAlerts();return;}
  if(Notification.permission==='denied'){toast('Permissão bloqueada — libere nas configurações do navegador');return;}
  Notification.requestPermission().then(p=>{
    if(p==='granted'){toast('Avisos ativados ✓');checkDeadlineAlerts();}
    else toast('Avisos não ativados');
  });
}
