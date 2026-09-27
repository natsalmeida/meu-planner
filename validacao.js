// features/validacao.js — gerado a partir do monólito; edite aqui a partir de agora.
import { areaById } from '../core/constantes.js';
import { store } from '../core/store.js';
import { durMin, fmtBR, fmtDur, todayISO } from '../core/datas.js';
import { h } from '../ui/base.js';
import { addLog } from '../views/diario.js';
import { hmToMin, nowHM } from '../views/unitins/hub.js';
import { addDaysISO } from '../views/analytics/graficos.js';

/* ---- Validação de sessões ----
   Toda sessão nova ou editada passa por validarLog: modal manual, cronômetro e "cumprir bloco".
   BLOQUEIO = dado impossível ou que contaria em dobro (não salva de jeito nenhum).
   AVISO    = plausível, mas raro o bastante para ser erro de digitação (salva com confirmação).
   Intervalos em minutos absolutos: uma sessão 23:30→00:40 colide corretamente com o dia seguinte. */
export const LOG_REGRAS={toleranciaMin:2, maxMinEstudo:240, maxMinTrabalho:720};
export function logIntervalo(l){
  const dia=Math.round(new Date(l.data+'T12:00').getTime()/864e5);
  const ini=dia*1440+hmToMin(l.ini);
  return {ini, fim:ini+durMin(l.ini,l.fim)};
}
export function logRotulo(l){
  return `${areaById(l.area).nome}${l.atividade?' ('+l.atividade+')':''} em ${fmtBR(l.data).slice(0,5)}, ${l.ini}–${l.fim}`;
}
export function logsPorData(){ const m={}; store.logs.forEach(l=>{(m[l.data]=m[l.data]||[]).push(l);}); return m; }
export function validarLog(d,ignorarId=null,idx=null){
  const bloq=[],avisos=[],conflitos=[];
  if(!d.data) bloq.push('Informe a data.');
  if(!d.ini||!d.fim) bloq.push('Preencha início e fim.');
  if(bloq.length) return {bloq,avisos,conflitos};
  const dur=durMin(d.ini,d.fim);
  if(dur===0) bloq.push('Início e fim iguais: a sessão teria 0 min.');
  const iv=logIntervalo(d);
  const agora=logIntervalo({data:todayISO(),ini:nowHM(),fim:nowHM()}).ini;
  if(d.data>todayISO()) bloq.push('A data está no futuro.');
  else if(iv.fim>agora) bloq.push(`O horário de fim ainda não chegou (a sessão terminaria ${iv.fim-agora>=1440?'amanhã':'às '+d.fim}).`);
  // só sessões do dia anterior, do mesmo dia e do seguinte podem colidir
  idx=idx||logsPorData();
  [addDaysISO(d.data,-1),d.data,addDaysISO(d.data,1)].forEach(dt=>(idx[dt]||[]).forEach(l=>{
    if(l.id===ignorarId||!l.ini||!l.fim)return;
    const o=logIntervalo(l);
    const sob=Math.min(iv.fim,o.fim)-Math.max(iv.ini,o.ini);
    if(sob>LOG_REGRAS.toleranciaMin){ conflitos.push(l); bloq.push(`Sobrepõe ${sob} min da sessão de ${logRotulo(l)}.`); }
  }));
  const trab=!areaById(d.area).conta;
  const max=trab?LOG_REGRAS.maxMinTrabalho:LOG_REGRAS.maxMinEstudo;
  if(dur>max) avisos.push(`Sessão de ${fmtDur(dur/60)}, acima do limite de ${max/60}h para ${trab?'trabalho':'estudo'}.`);
  if(dur>0&&hmToMin(d.fim)<hmToMin(d.ini)) avisos.push(`Atravessa a meia-noite: ${fmtDur(dur/60)} contadas em ${fmtBR(d.data)}.`);
  const ini0=store.periodos.map(p=>p.ini).filter(Boolean).sort()[0];
  if(ini0&&d.data<ini0) avisos.push(`Data anterior ao primeiro período cadastrado (${fmtBR(ini0)}). Confira o ano.`);
  return {bloq,avisos,conflitos};
}
export function logAlertaHTML(r){
  const lst=a=>`<ul>${a.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`;
  return (r.bloq.length?`<div class="log-alert bloq"><b>Não dá para salvar</b>${lst(r.bloq)}</div>`:'')
    +(!r.bloq.length&&r.avisos.length?`<div class="log-alert aviso"><b>Confira antes de salvar</b>${lst(r.avisos)}</div>`:'');
}
/* Mostra o resultado no próprio modal. Qualquer edição nos campos derruba o alerta
   e o "Salvar mesmo assim": a confirmação vale só para os valores que você viu. */
export function mostrarAlertaLog(r,editId){
  const box=document.getElementById('logAlert'); if(!box)return;
  box.innerHTML=logAlertaHTML(r);
  const btn=document.getElementById('logSalvar');
  if(btn){
    btn.textContent=(!r.bloq.length&&r.avisos.length)?'Salvar mesmo assim':(editId?'Salvar':'Salvar sessão');
    btn.onclick=()=>addLog(editId,!r.bloq.length&&r.avisos.length>0);
  }
  const m=document.querySelector('.modal');
  if(m&&!m._logWatch){ m._logWatch=true;
    const limpar=()=>{ box.innerHTML=''; if(btn){btn.textContent=editId?'Salvar':'Salvar sessão'; btn.onclick=()=>addLog(editId,false);} };
    m.addEventListener('input',limpar); m.addEventListener('change',limpar); }
  box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
/* Auditoria do histórico: a validação só protege daqui para frente. */
export function auditarLogs(){
  const idx=logsPorData(), vistos=new Set(), out=[];
  store.logs.forEach(l=>{
    const r=validarLog(l,l.id,idx);
    const probs=[...r.bloq.filter(b=>!b.startsWith('Sobrepõe')),...r.avisos.filter(a=>!a.startsWith('Atravessa'))];
    r.conflitos.forEach(c=>{ const k=[l.id,c.id].sort().join('|'); if(vistos.has(k))return; vistos.add(k);
      probs.push(`Sobrepõe a sessão de ${logRotulo(c)}.`); });
    if(probs.length) out.push({l,probs});
  });
  return out.sort((a,b)=>(b.l.data+b.l.ini).localeCompare(a.l.data+a.l.ini));
}
