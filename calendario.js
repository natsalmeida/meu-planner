// views/calendario.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../core/store.js';
import { fmtBR, todayISO } from '../core/datas.js';
import { h, modal } from '../ui/base.js';
import { go } from '../ui/router.js';
import { mPendencia } from './pendencias.js';
import { materiaNome } from './unitins/hub.js';
import { mSincrona } from './unitins/sincronas.js';

export let calMonth = (()=>{const d=new Date();return {y:d.getFullYear(),m:d.getMonth()};})();
export const MESES_PT=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const MESES_ABR=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export function calNav(delta){calMonth.m+=delta;if(calMonth.m<0){calMonth.m=11;calMonth.y--;}if(calMonth.m>11){calMonth.m=0;calMonth.y++;}vCalendario();}
export function calGo(y,m){calMonth={y:+y,m:+m};vCalendario();}
export function calHoje(){const d=new Date();calMonth={y:d.getFullYear(),m:d.getMonth()};vCalendario();}

/* Modelo de evento (dado, não HTML) — a mesma lista alimenta a grade, a agenda
   mobile e o modal do dia. Evita as três representações divergirem. */
export function calEventos(){
  const hoje=todayISO(), out={};
  const push=(iso,ev)=>{if(!iso)return;const k=iso.slice(0,10);(out[k]=out[k]||[]).push(ev);};
  store.pendencias.filter(p=>p.prazo&&!p.done).forEach(p=>{
    const late=p.prazo<hoje;
    push(p.prazo,{tipo:'pend',id:p.id,late,cor:late?'var(--red)':p.prio==='Alta'?'var(--red)':p.prio==='Média'?'var(--amber)':'var(--muted)',
      ord:'0',icon:late?'⚠':'○',txt:p.nome,sub:p.prio||'',
      tip:`Pendência: ${p.nome}${late?' (atrasada)':''} — clique para editar`});});
  store.entregaveis.filter(e=>e.prazo&&e.status!=='Entregue').forEach(e=>{
    const late=e.prazo<hoje, mat=materiaNome(e.materia);
    push(e.prazo,{tipo:'entreg',id:e.id,late,cor:late?'var(--red)':'var(--blue)',
      ord:'0',icon:'📌',txt:e.nome,sub:mat&&mat!=='—'?mat:'',
      tip:`Entregável UNITINS — ${mat}: ${e.nome}${late?' (atrasado)':''} — clique para abrir no Hub`});});
  store.sincronas.forEach(s=>{const mat=materiaNome(s.materia);
    push(s.data,{tipo:'sinc',id:s.id,late:false,cor:'var(--purple)',
      ord:s.ini||'99:99',icon:'🎥',txt:s.nome,sub:[s.ini,mat&&mat!=='—'?mat:''].filter(Boolean).join(' · '),
      tip:`Aula síncrona — ${mat}: ${s.nome} ${s.ini||''} — clique para editar`});});
  Object.values(out).forEach(a=>a.sort((x,y)=>x.ord.localeCompare(y.ord)));
  return out;
}
export function calEvHTML(ev,compacto){
  const label=compacto
    ? `${ev.icon} ${h(ev.tipo==='sinc'&&ev.ord!=='99:99'?ev.ord+' ':'')}${h(ev.txt)}`
    : `${ev.icon} ${h(ev.txt)}${ev.sub?` <span style="opacity:.82">· ${h(ev.sub)}</span>`:''}`;
  return `<div class="cal-ev" style="background:${ev.cor}" title="${h(ev.tip)}"
    onclick="calAbrir('${ev.tipo}','${ev.id}',event)">${label}</div>`;
}
export function calAbrir(tipo,id,ev){
  if(ev){ev.stopPropagation();}
  if(tipo==='pend')return mPendencia(id);
  if(tipo==='sinc')return mSincrona(id);
  if(tipo==='entreg'){window._uniTab='entregaveis';go('unitins');}
}

/* ---- Visão de ano inteiro (12 mini-meses) ----
   O calendário nunca teve limite de data; o que faltava era enxergar o ano de
   uma vez. A lista de anos é derivada dos dados (+3 à frente), então 2027, 2028…
   aparecem sozinhos conforme você lança prazos lá. As setas não têm limite. */
export let calVista='mes';
export function setCalVista(v){calVista=v;vCalendario();}
export function calAnoNav(d){calMonth.y+=d;vCalendario();}
export function calAbrirMes(y,m){calMonth={y:+y,m:+m};calVista='mes';vCalendario();}
export function anosCalendario(){
  const set=new Set([new Date().getFullYear(),calMonth.y]);
  const add=iso=>{if(iso&&/^\d{4}/.test(iso))set.add(+iso.slice(0,4));};
  store.pendencias.forEach(p=>add(p.prazo));
  store.entregaveis.forEach(e=>add(e.prazo));
  store.sincronas.forEach(s=>add(s.data));
  store.periodos.forEach(p=>{add(p.ini);add(p.fim);});
  const arr=[...set], out=[];
  for(let y=Math.min(...arr)-1;y<=Math.max(...arr)+3;y++)out.push(y);
  return out;
}
export function calCorDia(dia){
  if(dia.some(e=>e.late))return 'var(--red)';
  if(dia.some(e=>e.tipo==='entreg'))return 'var(--blue)';
  if(dia.some(e=>e.tipo==='sinc'))return 'var(--purple)';
  return 'var(--muted)';
}
export function calAnoHTML(y,evs){
  const hoje=todayISO(), mAtual=new Date().getMonth(), yAtual=new Date().getFullYear();
  let total=0;
  const meses=[];
  for(let m=0;m<12;m++){
    const off=(new Date(y,m,1).getDay()+6)%7, nd=new Date(y,m+1,0).getDate();
    let cells='', cnt=0;
    for(let i=0;i<off;i++)cells+='<div class="ym-d pad"></div>';
    for(let d=1;d<=nd;d++){
      const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dia=evs[iso]||[]; cnt+=dia.length;
      const fds=[5,6].includes((new Date(iso+'T12:00').getDay()+6)%7);
      const tip=dia.length
        ? `${fmtBR(iso)} — ${dia.map(e=>e.txt).join(' · ')}`
        : `${fmtBR(iso)} — clique para criar uma pendência`;
      cells+=`<div class="ym-d ${dia.length?'has':''} ${fds?'fds':''} ${iso===hoje?'hoje':''}"
        style="${dia.length?`background:${calCorDia(dia)}`:''}" title="${h(tip)}"
        onclick="${dia.length?`calDiaModal('${iso}')`:`novaPendenciaNoDia('${iso}')`}">${d}</div>`;
    }
    total+=cnt;
    meses.push(`<div class="ym ${(y===yAtual&&m===mAtual)?'ym-atual':''}">
      <div class="ym-h"><button onclick="calAbrirMes(${y},${m})" title="Abrir ${MESES_PT[m]} em detalhe">${MESES_PT[m]}</button>
        ${cnt?`<small>${cnt}</small>`:''}</div>
      <div class="ym-g">${['S','T','Q','Q','S','S','D'].map(x=>`<div class="ym-wd">${x}</div>`).join('')}</div>
      <div class="ym-g" style="margin-top:2px">${cells}</div>
    </div>`);
  }
  return {html:`<div class="ym-wrap">${meses.join('')}</div>`,total};
}
export function calDiaModal(iso){
  const evs=(calEventos()[iso]||[]);
  const d=new Date(iso+'T12:00');
  modal(`<h3 style="text-transform:capitalize">${d.getDate()} de ${MESES_PT[d.getMonth()]}</h3>
    <div class="h-sub">${['domingo','segunda','terça','quarta','quinta','sexta','sábado'][d.getDay()]} · ${evs.length} ${evs.length===1?'item':'itens'}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:14px">
      ${evs.length?evs.map(e=>calEvHTML(e,false)).join(''):'<div class="empty">Nada marcado neste dia.</div>'}
    </div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
    <button class="btn" onclick="closeModal();novaPendenciaNoDia('${iso}')">+ Pendência</button></div>`);
}
export function vCalendario(){
  const {y,m}=calMonth;
  const first=new Date(y,m,1);
  const startOffset=(first.getDay()+6)%7;                 // segunda = 0
  const daysInMonth=new Date(y,m+1,0).getDate();
  const abbr=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const evs=calEventos(), hoje=todayISO();
  const MAX=3;                                            // itens visíveis por célula; o resto vira "+N"
  const isoDe=d=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  let cells=abbr.map(a=>`<div class="mc-head">${a}</div>`).join('');
  for(let i=0;i<startOffset;i++)cells+=`<div class="mc-cell mc-empty"></div>`;
  let totalMes=0;
  for(let d=1;d<=daysInMonth;d++){
    const iso=isoDe(d), dia=evs[iso]||[]; totalMes+=dia.length;
    const fds=[5,6].includes((new Date(iso+'T12:00').getDay()+6)%7);
    const vis=dia.slice(0,MAX).map(e=>calEvHTML(e,true)).join('');
    const rest=dia.length-MAX;
    cells+=`<div class="mc-cell mc-click ${iso===hoje?'mc-today':''} ${fds?'mc-wk':''}"
      onclick="novaPendenciaNoDia('${iso}',event)" title="Clique para criar uma pendência em ${fmtBR(iso)}">
      <div class="mc-num">${d}</div>${vis}
      ${rest>0?`<button class="cal-more" onclick="event.stopPropagation();calDiaModal('${iso}')">+${rest} ${rest===1?'item':'itens'}</button>`:''}
    </div>`;
  }

  // Agenda (≤760px): só dias com evento, texto inteiro, sem grade espremida
  const agenda=[];
  for(let d=1;d<=daysInMonth;d++){
    const iso=isoDe(d), dia=evs[iso]||[]; if(!dia.length)continue;
    const wd=['dom','seg','ter','qua','qui','sex','sáb'][new Date(iso+'T12:00').getDay()];
    agenda.push(`<div class="cal-ag-day ${iso===hoje?'hoje':''}">
      <div class="cal-ag-date"><b>${d}</b><span>${wd}</span></div>
      <div class="cal-ag-evs">${dia.map(e=>calEvHTML(e,false)).join('')}</div></div>`);
  }

  const anos=anosCalendario();
  const ano=calAnoHTML(y,evs);
  const navMes=`
      <button class="btn line sm" onclick="calNav(-1)" title="Mês anterior">‹</button>
      <select class="st-select" onchange="calGo(${y},this.value)" style="font-size:14px;padding:7px 10px;text-transform:capitalize">
        ${MESES_PT.map((n,i)=>`<option value="${i}" ${i===m?'selected':''}>${n}</option>`).join('')}
      </select>
      <select class="st-select" onchange="calGo(this.value,${m})" style="font-size:14px;padding:7px 10px">
        ${anos.map(a=>`<option value="${a}" ${a===y?'selected':''}>${a}</option>`).join('')}
      </select>
      <button class="btn line sm" onclick="calNav(1)" title="Próximo mês">›</button>`;
  const navAno=`
      <button class="btn line sm" onclick="calAnoNav(-1)" title="Ano anterior">‹</button>
      <select class="st-select" onchange="calGo(this.value,${m})" style="font-size:14px;padding:7px 10px">
        ${anos.map(a=>`<option value="${a}" ${a===y?'selected':''}>${a}</option>`).join('')}
      </select>
      <button class="btn line sm" onclick="calAnoNav(1)" title="Próximo ano">›</button>`;
  const ehAno=calVista==='ano';

  document.getElementById('view').innerHTML=`
    <div class="page-title">calendário</div>
    <div class="page-sub">Só aparece aqui o que tem data marcada: pendências com prazo, entregáveis da UNITINS e aulas síncronas. Clique num dia vazio para criar uma pendência já com aquela data; clique num evento para abri-lo. A navegação não tem data-limite — 2027, 2028 e seguintes já existem.</div>
    <div class="cal-toolbar">
      <div class="cal-switch">
        <button class="${ehAno?'':'on'}" onclick="setCalVista('mes')">Mês</button>
        <button class="${ehAno?'on':''}" onclick="setCalVista('ano')">Ano</button>
      </div>
      ${ehAno?navAno:navMes}
      <button class="btn line sm" onclick="calHoje()">Hoje</button>
      ${ehAno
        ? `<span class="pill ${ano.total?'purple':'gray'}">${ano.total} ${ano.total===1?'item em':'itens em'} ${y}</span>`
        : `<span class="pill ${totalMes?'purple':'gray'}">${totalMes} ${totalMes===1?'item no mês':'itens no mês'}</span>`}
      <div class="cal-legend">
        <span><i style="background:var(--blue)"></i>Entregável</span>
        <span><i style="background:var(--purple)"></i>Aula síncrona</span>
        <span><i style="background:var(--muted)"></i>Pendência</span>
        <span><i style="background:var(--red)"></i>Atrasado</span>
      </div>
    </div>
    ${ehAno ? ano.html : `
    <div class="cal-grid-wrap"><div class="mcal">${cells}</div></div>
    <div class="cal-agenda card">${agenda.length?agenda.join(''):'<div class="empty">Nada marcado em '+MESES_PT[m]+'.</div>'}</div>`}`;
}
