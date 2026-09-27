// views/dashboard.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, areaById } from '../core/constantes.js';
import { store } from '../core/store.js';
import { save } from '../core/sync.js';
import { durH, fmtBR, fmtDur, todayISO, weekKey } from '../core/datas.js';
import { hoursThisWeek, hoursThisWeekByArea, inicioSemanaISO, isAtrasado, studyStreak, workHoursMonth, workHoursOnDay, workHoursWeek, workHoursYear, workLogs } from '../core/horas.js';
import { labelPrazo, upcomingDeadlines } from '../features/prazos.js';
import { areaPill, closeModal, h, modal, toast } from '../ui/base.js';
import { dashSincronasCard } from './unitins/sincronas.js';
import { urgPill } from './unitins/entregaveis.js';
import { addDaysISO } from './analytics/graficos.js';
import { dashHabitChips, dashHabitRiscos } from './habitos/habitos.js';
import { finDashCard } from '../financas/dashboard.js';

/* ---------------- Views ---------------- */
export function metaSemanalCard(){
  const feito=Math.round(hoursThisWeek()*100)/100;
  const meta=store.metaSemanal||0;
  const pct=meta>0?Math.min(100,Math.round(feito/meta*100)):0;
  const falta=Math.max(0,Math.round((meta-feito)*100)/100);
  const bateu=meta>0&&feito>=meta;
  // metas por área definidas
  const areasComMeta=AREAS.filter(a=>a.conta&&(store.metasArea[a.id]||0)>0);
  const linhasArea=areasComMeta.map(a=>{
    const mt=store.metasArea[a.id]; const fz=Math.round(hoursThisWeekByArea(a.id)*100)/100;
    const p=Math.min(100,Math.round(fz/mt*100)); const ok=fz>=mt;
    return `<div class="bar-row"><div class="lbl">${a.nome}</div>
      <div class="bar-track"><i style="width:${p}%;background:${ok?'var(--green)':a.cor}"></i></div>
      <div class="val">${fmtDur(fz)}/${fmtDur(mt)}</div></div>`;}).join('');
  return `<div class="card" style="margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div><h3>Meta de estudo semanal</h3><div class="h-sub" style="margin-bottom:0">Horas de estudo nesta semana · TRE tem card próprio abaixo</div></div>
      <button class="btn sm line" onclick="mMetaSemanal()">Editar metas</button>
    </div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
      <span style="font-family:var(--serif);font-size:32px;font-weight:600;color:var(--purple)">${fmtDur(feito)}</span>
      <span style="color:var(--muted);font-size:15px">de ${fmtDur(meta)} no total · ${pct}%</span>
      <span style="margin-left:auto;font-size:13px;color:${bateu?'var(--green)':'var(--muted)'};font-weight:600">
        ${bateu?'✓ Meta batida!':`faltam ${fmtDur(falta)}`}</span>
    </div>
    <div class="progress" style="height:12px"><i style="width:${pct}%;background:${bateu?'var(--green)':'linear-gradient(90deg,var(--purple),var(--rose))'}"></i></div>
    ${areasComMeta.length?`<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px">
      <div class="h-sub" style="margin-bottom:10px">Por área</div><div class="bars">${linhasArea}</div></div>`:''}
  </div>`;
}
export function mMetaSemanal(){modal(`<h3>Metas de estudo semanal</h3>
  <div class="field"><label>Meta total (horas por semana — use 0,5 para 30min)</label>
    <input type="number" id="ms" min="0" step="0.5" value="${store.metaSemanal||0}"></div>
  <div style="border-top:1px solid var(--line);margin:6px 0 14px;padding-top:14px">
    <div class="h-sub" style="margin-bottom:10px">Metas por área (opcional — deixe 0 para não acompanhar)</div>
    ${AREAS.filter(a=>a.conta).map(a=>`<div class="field" style="margin-bottom:9px">
      <label>${a.nome}</label><input type="number" id="ma_${a.id}" min="0" step="0.5" value="${store.metasArea[a.id]||0}"></div>`).join('')}
  </div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="saveMetaSemanal()">Salvar</button></div>`);
  setTimeout(()=>document.getElementById('ms').focus(),50);}
export function saveMetaSemanal(){const v=parseFloat(document.getElementById('ms').value);
  store.metaSemanal=isNaN(v)?0:v;
  AREAS.filter(a=>a.conta).forEach(a=>{const el=document.getElementById('ma_'+a.id);
    const n=parseFloat(el.value); store.metasArea[a.id]=isNaN(n)?0:n;});
  save();closeModal();vDashboard();toast('Metas atualizadas');}

/* Card de carga de trabalho — deliberadamente cinza, sem barra de progresso e sem
   meta. Trabalho levado para casa não é conquista; a linguagem visual não pode
   sugerir que encher a barra é bom. Sem teto por enquanto: só acumulado + tendência. */
export function trabalhoCard(){
  const logs=workLogs(); if(!logs.length)return '';
  const cor=areaById('tre').cor, hoje=todayISO();
  const wkAtual=weekKey(hoje), wkAnt=weekKey(addDaysISO(hoje,-7));
  const sem=workHoursWeek(wkAtual), semAnt=workHoursWeek(wkAnt);
  const mes=workHoursMonth(), ano=workHoursYear(hoje.slice(0,4));
  const dif=sem-semAnt;
  const ultimas=logs.slice().sort((a,b)=>(b.data+b.ini).localeCompare(a.data+a.ini)).slice(0,3);
  /* Faixa de números do dia. Cinza-ardósia de propósito: mesma estrutura da faixa
     do topo, sem o roxo/gradiente de conquista — trabalho em casa não é streak. */
  const seg=inicioSemanaISO(hoje);
  const porDia=Array.from({length:7},(_,i)=>{const d=addDaysISO(seg,i);return workHoursOnDay(d);});
  const hojeH=workHoursOnDay(hoje);
  const diasComCarga=porDia.filter(v=>v>0).length;
  const picoDia=Math.max(...porDia);
  const mediaDia=diasComCarga?porDia.reduce((s,v)=>s+v,0)/diasComCarga:0;
  return `<div class="card" style="margin-bottom:20px;border-left:3px solid ${cor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div><h3>Carga de trabalho · TRE em casa</h3>
        <div class="h-sub" style="margin-bottom:0">Contabilizado à parte. Não entra nas horas estudadas, nas metas nem no hábito de estudo.</div></div>
    </div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
      <span style="font-family:var(--serif);font-size:32px;font-weight:600;color:${cor}">${fmtDur(sem)}</span>
      <span style="color:var(--muted);font-size:15px">esta semana</span>
      ${semAnt>0||sem>0?`<span class="pill ${dif>0?'amber':dif<0?'green':'gray'}" title="Comparado à semana anterior (${fmtDur(semAnt)})">
        ${dif>0?'▲':dif<0?'▼':'='} ${fmtDur(Math.abs(dif))} vs. semana anterior</span>`:''}
      <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill gray">${fmtDur(mes)} no mês</span>
        <span class="pill gray">${fmtDur(ano)} em ${hoje.slice(0,4)}</span>
        <span class="pill gray">${logs.length} ${logs.length===1?'sessão':'sessões'}</span>
      </span>
    </div>
    <div class="stat-row" style="margin-top:14px;background:linear-gradient(120deg,${cor},#585365);padding:18px 22px">
      <div class="stat"><b>${fmtDur(hojeH)}</b><span>trabalhadas hoje</span></div>
      <div class="stat"><b>${fmtDur(mediaDia)}</b><span>média por dia com carga</span></div>
      <div class="stat"><b>${diasComCarga}/7</b><span>dias com carga na semana</span></div>
    </div>
    <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">
      <div class="h-sub" style="margin-bottom:8px">Últimos lançamentos</div>
      ${ultimas.map(l=>`<div style="display:flex;gap:10px;font-size:13px;padding:4px 0;color:var(--muted)">
        <span style="color:var(--ink);font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(l.atividade||'(sem atividade)')}</span>
        <span>${fmtBR(l.data)}</span><span style="font-weight:600">${fmtDur(durH(l.ini,l.fim))}</span></div>`).join('')}
    </div>
  </div>`;
}
export function vDashboard(){
  const hoje=todayISO();
  const logsHoje=store.logs.filter(l=>l.data===hoje);
  const hEstHoje=logsHoje.filter(l=>areaById(l.area).conta).reduce((s,l)=>s+durH(l.ini,l.fim),0);
  const pendAbertas=store.pendencias.filter(p=>!p.done).length;
  const streak=studyStreak();
  const hr=new Date().getHours();
  const saud=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const entregProx=store.entregaveis.filter(e=>e.status!=='Entregue'&&e.prazo)
    .sort((a,b)=>a.prazo.localeCompare(b.prazo)).slice(0,4);
  // atrasados
  const pendAtras=store.pendencias.filter(p=>isAtrasado(p.prazo,p.done));
  const entrAtras=store.entregaveis.filter(e=>isAtrasado(e.prazo,e.status==='Entregue'));
  const atrasados=[...entrAtras.map(e=>({tipo:'Entregável',nome:e.nome,prazo:e.prazo})),
                   ...pendAtras.map(p=>({tipo:'Pendência',nome:p.nome,prazo:p.prazo}))]
                   .sort((a,b)=>a.prazo.localeCompare(b.prazo));

  document.getElementById('view').innerHTML=`
    <div class="page-title">${saud}!</div>
    <div class="page-sub">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div>
    ${dashSincronasCard()}
    ${atrasados.length?`<div class="card alert-late" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">⚠️</span><h3 style="color:var(--red)">Atrasados (${atrasados.length})</h3></div>
      ${atrasados.map(a=>`<div class="list-item">
        <div class="li-body"><div class="t">${h(a.nome)}</div>
        <div class="m"><span class="pill red">${a.tipo}</span> venceu em ${fmtBR(a.prazo)}</div></div></div>`).join('')}
    </div>`:''}
    ${(()=>{const vb=upcomingDeadlines().filter(it=>it.d>=0&&!(it.tipo==='Aula síncrona'&&it.d===0));return vb.length?`<div class="card" style="margin-bottom:20px;border:1px solid var(--amber);background:var(--amber-soft)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">⏳</span><h3 style="color:var(--amber)">Vence em breve — próximos 3 dias (${vb.length})</h3></div>
      ${vb.map(it=>`<div class="list-item">
        <div class="li-body"><div class="t">${h(it.nome)}</div>
        <div class="m"><span class="pill ${it.tipo==='Aula síncrona'?'blue':(it.d<=1?'red':'amber')}">${it.tipo}</span> ${it.label||labelPrazo(it.d)} · ${fmtBR(it.prazo)}</div></div></div>`).join('')}
    </div>`:'';})()}
    ${finDashCard()}
    <div class="stat-row" style="margin-bottom:20px">
      <div class="stat"><b>${fmtDur(hEstHoje)}</b><span>estudadas hoje</span></div>
      <div class="stat"><b>🔥 ${streak}</b><span>${streak===1?'dia seguido':'dias seguidos'}</span></div>
      <div class="stat"><b>${pendAbertas}</b><span>pendências abertas</span></div>
    </div>
    ${metaSemanalCard()}
    ${trabalhoCard()}
    <div class="row">
      <div class="card" style="flex:1;min-width:320px">
        <h3>Sessões de hoje</h3><div class="h-sub">Lançamentos no Diário de Bordo</div>
        ${logsHoje.length?logsHoje.map(l=>`<div class="list-item">
          <div class="li-body"><div class="t">${h(l.atividade||areaById(l.area).nome)}</div>
          <div class="m">${areaPill(l.area)} ${l.ini}–${l.fim} · ${fmtDur(durH(l.ini,l.fim))}</div>
          ${l.obs?`<div class="m" style="color:var(--muted)">${h(l.obs)}</div>`:''}</div></div>`).join('')
          :`<div class="empty">Nada lançado ainda hoje.<br><button class="btn sm ghost" style="margin-top:12px" onclick="go('diarios')">Registrar sessão</button></div>`}
      </div>
      <div class="card" style="flex:1;min-width:320px">
        <h3>Próximos prazos</h3><div class="h-sub">Entregáveis da UNITINS</div>
        ${entregProx.length?entregProx.map(e=>`<div class="list-item">
          <div class="li-body"><div class="t">${h(e.nome)}</div>
          <div class="m"><span class="pill gray">${fmtBR(e.prazo)}</span> ${urgPill(e)}</div></div></div>`).join('')
          :`<div class="empty">Sem entregáveis pendentes.</div>`}
      </div>
    </div>
    <div class="row" style="margin-top:18px">
      <div class="card" style="flex:1;min-width:280px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><h3>Hábitos de hoje</h3><div class="h-sub" style="margin-bottom:0">Toque no que você fez · sem meta diária</div></div>
          <button class="btn sm line" onclick="go('habitos')">Ver tudo</button>
        </div>
        <div style="margin-top:12px">${dashHabitChips()}${dashHabitRiscos()}</div>
      </div>
      <div class="card" style="flex:1;min-width:280px"><h3>Ações rápidas</h3><div class="h-sub">Adicione sem sair daqui</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" onclick="mNovaSessao()">+ Nova sessão</button>
          <button class="btn ghost" onclick="mPendencia()">+ Nova pendência</button>
          <button class="btn line" onclick="timerOpenPanel()">⏱ Iniciar cronômetro</button>
        </div>
      </div>
    </div>`;
}
