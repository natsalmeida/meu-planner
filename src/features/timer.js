// features/timer.js — gerado a partir do monólito; edite aqui a partir de agora.
import { areaById } from '../core/constantes.js';
import { areaOptions, h, toast } from '../ui/base.js';
import { mNovaSessao } from '../views/diario.js';

/* ---------------- Cronômetro ---------------- */
// origStart: momento do 1º "Iniciar" (fixo, usado como data/hora início ao salvar)
// segStart: momento em que o trecho ATUAL em execução começou (null se pausado/parado)
// accumMs: soma dos trechos já concluídos (pausas não entram aqui)
export let timerState = {running:false, area:'unitins', atividade:'', origStart:null, segStart:null, accumMs:0};
export let timerPanelOpen = false;
export let timerIntervalId = null;

export function loadTimerState(){
  try{const raw=localStorage.getItem('planner_timer_v1');
    if(raw){const d=JSON.parse(raw); if(d&&typeof d==='object')Object.assign(timerState,d);}
  }catch(e){}
}
export function saveTimerState(){
  try{localStorage.setItem('planner_timer_v1',JSON.stringify(timerState));}catch(e){}
}
export function fmtHMS(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const hh=Math.floor(s/3600), mm=Math.floor((s%3600)/60), ss=s%60;
  const p=n=>String(n).padStart(2,'0');
  return hh>0?`${p(hh)}:${p(mm)}:${p(ss)}`:`${p(mm)}:${p(ss)}`;
}
export function timerElapsedMs(){
  return timerState.accumMs + (timerState.running&&timerState.segStart ? Date.now()-timerState.segStart : 0);
}
export function timerEnsureTicking(){
  clearInterval(timerIntervalId);
  if(timerState.running){
    timerIntervalId=setInterval(()=>{
      const el=document.getElementById('timerClock');
      if(el) el.textContent=fmtHMS(timerElapsedMs());
    },1000);
  }
}
export function timerOpenPanel(){timerPanelOpen=true;renderTimerWidget();}
export function timerClosePanel(){timerPanelOpen=false;renderTimerWidget();}
export function timerTogglePanel(){timerPanelOpen=!timerPanelOpen;renderTimerWidget();}
export function timerSetArea(v){timerState.area=v;saveTimerState();}
export function timerSetAtividade(v){timerState.atividade=v;saveTimerState();}
export function timerStart(){
  const areaSel=document.getElementById('tmArea'); const atSel=document.getElementById('tmAtividade');
  if(areaSel)timerState.area=areaSel.value;
  if(atSel)timerState.atividade=atSel.value.trim();
  const now=Date.now();
  timerState.running=true; timerState.origStart=now; timerState.segStart=now; timerState.accumMs=0;
  saveTimerState(); timerEnsureTicking(); renderTimerWidget();
}
export function timerPause(){
  if(!timerState.running)return;
  timerState.accumMs=timerElapsedMs(); timerState.running=false; timerState.segStart=null;
  saveTimerState(); timerEnsureTicking(); renderTimerWidget();
}
export function timerResume(){
  if(timerState.running||!timerState.origStart)return;
  timerState.segStart=Date.now(); timerState.running=true;
  saveTimerState(); timerEnsureTicking(); renderTimerWidget();
}
export function timerDiscard(){
  clearInterval(timerIntervalId);
  timerState={running:false,area:timerState.area,atividade:'',origStart:null,segStart:null,accumMs:0};
  saveTimerState(); timerPanelOpen=false; renderTimerWidget();
  toast('Cronômetro descartado');
}
export function timerStop(){
  const elapsed=timerElapsedMs();
  const start=new Date(timerState.origStart);
  const end=new Date(timerState.origStart+elapsed); // ignora o tempo pausado, soma só o tempo ativo
  const pad=n=>String(n).padStart(2,'0');
  const data=start.getFullYear()+'-'+pad(start.getMonth()+1)+'-'+pad(start.getDate());
  const ini=pad(start.getHours())+':'+pad(start.getMinutes());
  const fim=pad(end.getHours())+':'+pad(end.getMinutes());
  const longo=elapsed>=12*36e5; // 12h+ de cronômetro é esquecimento; >=24h daria volta no relógio e mentiria
  const prefill={area:timerState.area,atividade:timerState.atividade,data,ini,fim:longo?'':fim,origem:'timer',
    timerLongo:longo?elapsed/36e5:0};
  clearInterval(timerIntervalId);
  timerState={running:false,area:prefill.area,atividade:'',origStart:null,segStart:null,accumMs:0};
  saveTimerState(); timerPanelOpen=false; renderTimerWidget();
  mNovaSessao('',null,prefill);
}
export function renderTimerWidget(){
  const el=document.getElementById('timerWidget'); if(!el)return;
  const idle = !timerState.origStart;
  const paused = !idle && !timerState.running;
  if(idle){
    if(!timerPanelOpen){
      el.innerHTML=`<button class="timer-fab" onclick="timerOpenPanel()" title="Cronômetro">⏱</button>`;
    }else{
      el.innerHTML=`<div class="timer-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <b style="font-size:14px">⏱ Cronômetro</b>
          <button class="icon-btn" onclick="timerClosePanel()">✕</button>
        </div>
        <div class="field" style="margin-bottom:8px"><label>Área</label>
          <select id="tmArea" onchange="timerSetArea(this.value)">${areaOptions(timerState.area)}</select></div>
        <div class="field" style="margin-bottom:10px"><label>Atividade (opcional)</label>
          <input id="tmAtividade" placeholder="Ex: Aula de Cálculo" value="${h(timerState.atividade)}" oninput="timerSetAtividade(this.value)"></div>
        <button class="btn" style="width:100%;justify-content:center" onclick="timerStart()">▶ Iniciar</button>
      </div>`;
    }
    return;
  }
  const elapsed=fmtHMS(timerElapsedMs());
  if(!timerPanelOpen){
    el.innerHTML=`<button class="timer-fab ${paused?'timer-fab-paused':'timer-fab-running'}" onclick="timerOpenPanel()" title="${paused?'Cronômetro pausado':'Cronômetro rodando'}">
      <span class="timer-dot ${paused?'timer-dot-paused':''}"></span><span id="timerClock">${elapsed}</span></button>`;
  }else{
    el.innerHTML=`<div class="timer-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <b style="font-size:14px"><span class="timer-dot ${paused?'timer-dot-paused':''}" style="position:static;display:inline-block;margin-right:6px"></span>${paused?'Cronômetro pausado':'Cronômetro rodando'}</b>
        <button class="icon-btn" onclick="timerClosePanel()">✕</button>
      </div>
      <div class="timer-clock-big" id="timerClock" style="${paused?'color:var(--amber)':''}">${elapsed}</div>
      <div style="font-size:12px;color:var(--faint);margin-bottom:10px">${areaById(timerState.area).nome}${timerState.atividade?' · '+h(timerState.atividade):''}</div>
      <input id="tmAtividade" placeholder="Atividade (opcional)" value="${h(timerState.atividade)}" oninput="timerSetAtividade(this.value)" style="margin-bottom:10px">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        ${paused?`<button class="btn" style="flex:1;justify-content:center" onclick="timerResume()">▶ Continuar</button>`
                :`<button class="btn ghost" style="flex:1;justify-content:center" onclick="timerPause()">⏸ Pausar</button>`}
        <button class="btn line" style="flex:1;justify-content:center" onclick="timerDiscard()">Descartar</button>
      </div>
      <button class="btn" style="width:100%;justify-content:center;background:var(--rose)" onclick="timerStop()">■ Parar e salvar</button>
    </div>`;
  }
}
