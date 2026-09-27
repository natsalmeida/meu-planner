// views/habitos/habitos.js — gerado a partir do monólito; edite aqui a partir de agora.
import { areaById } from '../../core/constantes.js';
import { store } from '../../core/store.js';
import { save, saveHabitDay } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { durMin, fmtBR, fmtDur, localISO, todayISO } from '../../core/datas.js';
import { countableLogs } from '../../core/horas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { current } from '../../ui/router.js';
import { vDashboard } from '../dashboard.js';
import { MESES_ABR } from '../calendario.js';
import { addDaysISO, anMonday, anoAtual, anosComDado, hoursOnDay } from '../analytics/graficos.js';
import { hbEstante } from './estante.js';

/* ---------------- Hábitos ---------------- */
/* Modelo: {id,nome,icon,cor,auto,excluir[],freq:'diario'|'semanal'|'dias',alvo:N,dias:[0..6],minMin}
   freq define o que é "esperado" — sem isso, taxa e streak medem a coisa errada
   para qualquer hábito que não seja diário. */

/* ---- índice por data: evita varrer store.logs a cada célula renderizada ---- */
export let _hbDayIdx=null;
export function invalidateHabitCache(){_hbDayIdx=null;}
export function dayLogIndex(){
  if(_hbDayIdx) return _hbDayIdx;
  const m=Object.create(null);
  countableLogs().forEach(l=>{ (m[l.data]||(m[l.data]=[])).push(l); });
  _hbDayIdx=m; return m;
}
export function logCountsForAuto(hb,l){
  const excl=(hb&&hb.excluir)||[];
  if(!excl.length)return true;
  const a=(l.atividade||'').trim().toLowerCase();
  return !excl.some(x=>String(x).trim().toLowerCase()===a);
}
export function habitDone(id,iso){
  const hb=store.habitos.find(x=>x.id===id);
  if(hb&&hb.auto){
    const arr=dayLogIndex()[iso]; if(!arr)return false;
    const min=arr.reduce((s,l)=>s+(logCountsForAuto(hb,l)?durMin(l.ini,l.fim):0),0);
    return min>=Math.max(1,hb.minMin||1);   // limiar: "houve estudo" ≠ "houve dia de estudo"
  }
  return !!(store.habitLog[iso]&&store.habitLog[iso][id]);
}
export function toggleHabito(id,iso){
  iso=iso||todayISO();
  const hb=store.habitos.find(x=>x.id===id); if(!hb)return;
  if(hb.auto){toast(hb.nome+' é automático — vem do Diário de Bordo');return;}
  if(iso>todayISO()){toast('Não dá para marcar um dia futuro');return;}
  if(!store.habitLog[iso])store.habitLog[iso]={};
  if(store.habitLog[iso][id]){delete store.habitLog[iso][id];
    if(!Object.keys(store.habitLog[iso]).length)delete store.habitLog[iso];}
  else store.habitLog[iso][id]=true;
  saveHabitDay(iso);
  if(current==='habitos')vHabitos(); else if(current==='dashboard')vDashboard();
}

/* ---- frequência-alvo ---- */
export function hbFreq(hb){return hb.freq||'diario';}
export function hbDiaEsperado(hb,iso){
  const f=hbFreq(hb);
  if(f==='diario')return true;
  if(f==='dias')return (hb.dias||[]).includes(new Date(iso+'T12:00').getDay());
  return null;   // 'semanal': não há dia esperado — a cobrança é por semana
}
export function hbAlvoSemana(hb){
  const f=hbFreq(hb);
  if(f==='semanal')return Math.max(1,Math.min(7,hb.alvo||3));
  if(f==='dias')return Math.max(1,(hb.dias||[]).length);
  return 7;
}
export function hbLabelFreq(hb){
  const f=hbFreq(hb);
  if(f==='diario')return 'todo dia';
  if(f==='semanal')return hbAlvoSemana(hb)+'× por semana';
  const wd=['dom','seg','ter','qua','qui','sex','sáb'];
  return (hb.dias||[]).slice().sort().map(d=>wd[d]).join('/')||'sem dias definidos';
}
export function semanaDias(monISO){const out=[];for(let i=0;i<7;i++)out.push(addDaysISO(monISO,i));return out;}
export function hbFeitosNaSemana(hb,monISO){
  return semanaDias(monISO).filter(iso=>iso<=todayISO()&&habitDone(hb.id,iso)).length;
}
export function ultimasSemanasCompletas(n){
  const out=[];for(let i=n;i>=1;i--)out.push(localISO(anMonday(-i)));return out;
}

/* ---- taxa: feitos ÷ ESPERADOS (não ÷ dias corridos) ---- */
export function hbTaxa(hb){
  const f=hbFreq(hb);
  if(f==='diario'){
    // 28 dias encerrados — hoje fica de fora porque ainda está em curso
    let feitos=0;for(let i=1;i<=28;i++)if(habitDone(hb.id,addDaysISO(todayISO(),-i)))feitos++;
    return {pct:Math.round(feitos/28*100),feitos,esp:28,janela:'28 dias'};
  }
  const sems=ultimasSemanasCompletas(4), alvo=hbAlvoSemana(hb);
  let feitos=0;
  // teto por semana: fazer 5× numa semana de alvo 3 não compensa a semana zerada
  sems.forEach(mon=>{feitos+=Math.min(alvo,hbFeitosNaSemana(hb,mon));});
  const esp=alvo*sems.length;
  return {pct:esp?Math.round(feitos/esp*100):0,feitos,esp,janela:'4 semanas'};
}

/* ---- streak na unidade certa ---- */
export function hbStreak(hb){
  const f=hbFreq(hb), hoje=todayISO();
  if(f==='semanal'){
    let n=0, i=0;
    if(hbFeitosNaSemana(hb,localISO(anMonday(0)))>=hbAlvoSemana(hb))n++;   // semana em curso só soma se já bateu
    i=1;
    while(i<=104){const mon=localISO(anMonday(-i));
      if(hbFeitosNaSemana(hb,mon)>=hbAlvoSemana(hb)){n++;i++;}else break;}
    return {n,un:'sem'};
  }
  let n=0;const d=new Date();
  if(hbDiaEsperado(hb,localISO(d))&&!habitDone(hb.id,localISO(d)))d.setDate(d.getDate()-1); // hoje pendente não zera
  let guard=0;
  while(guard++<400){
    const iso=localISO(d);
    if(!hbDiaEsperado(hb,iso)){d.setDate(d.getDate()-1);continue;}            // folga programada não quebra
    if(!habitDone(hb.id,iso))break;
    n++;d.setDate(d.getDate()-1);
  }
  return {n,un:'d'};
}
export function habitDoneToday(){const t=todayISO();return store.habitos.filter(hb=>habitDone(hb.id,t)).length;}
export function habitYearCount(id,ano){ano=ano||new Date().getFullYear();const y=String(ano);
  const hb=store.habitos.find(x=>x.id===id);
  if(hb&&hb.auto)return Object.keys(dayLogIndex()).filter(iso=>iso.startsWith(y)&&habitDone(id,iso)).length;
  return Object.keys(store.habitLog).filter(iso=>iso.startsWith(y)&&store.habitLog[iso]&&store.habitLog[iso][id]).length;}
export function hbDiasFeitos(hb){
  const set=new Set();
  if(hb.auto)Object.keys(dayLogIndex()).forEach(iso=>{if(habitDone(hb.id,iso))set.add(iso);});
  else Object.keys(store.habitLog).forEach(iso=>{if(store.habitLog[iso]&&store.habitLog[iso][hb.id])set.add(iso);});
  return [...set].sort();
}
/* Melhor sequência que ATRAVESSA o ano, contada por inteiro. A versão anterior
   filtrava os dias por prefixo do ano antes de medir, então uma sequência de
   20/12 a 10/01 era partida em duas — um artefato do calendário, não do hábito. */
export function hbMelhorSequencia(hb,ano){
  const y=String(ano), feitos=hbDiasFeitos(hb), semanal=hbFreq(hb)==='semanal';
  if(!feitos.length)return {n:0,un:semanal?'sem':'d',cruza:false};
  const fim=todayISO();
  let cur=0,curIni=null,best=0,cruza=false,guard=0;
  const registra=(fimRun)=>{
    if(curIni.slice(0,4)<=y&&fimRun.slice(0,4)>=y&&cur>best){
      best=cur; cruza=(curIni.slice(0,4)!==y)||(fimRun.slice(0,4)!==y);}
  };
  if(semanal){
    const alvo=hbAlvoSemana(hb);
    const mon=new Date(feitos[0]+'T12:00'); mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
    while(localISO(mon)<=fim&&guard++<600){
      const mISO=localISO(mon);
      if(hbFeitosNaSemana(hb,mISO)>=alvo){ if(!cur)curIni=mISO; cur++; registra(addDaysISO(mISO,6)); }
      else cur=0;
      mon.setDate(mon.getDate()+7);
    }
    return {n:best,un:'sem',cruza};
  }
  const d=new Date(feitos[0]+'T12:00');
  while(localISO(d)<=fim&&guard++<4000){
    const iso=localISO(d);
    if(hbDiaEsperado(hb,iso)){
      if(habitDone(hb.id,iso)){ if(!cur)curIni=iso; cur++; registra(iso); }
      else cur=0;
    }
    d.setDate(d.getDate()+1);
  }
  return {n:best,un:'d',cruza};
}

/* ---- Visão do ano por mês (mini-calendários), com seleção de meses ----
   Substitui a grade de 8 semanas: o recorte de tempo passa a ser escolhido,
   não fixo. Dias passados continuam clicáveis para correção (exceto hábito
   automático, que é derivado do Diário de Bordo). */
export let hbMeses=null, _hbMesesAno=null;
export function mesesDoAno(ano){
  const hoje=new Date();
  if(ano<hoje.getFullYear())return [0,1,2,3,4,5,6,7,8,9,10,11];
  if(ano>hoje.getFullYear())return [0];
  return Array.from({length:hoje.getMonth()+1},(_,i)=>i);   // jan → mês atual
}
export function hbMesesSel(ano){
  if(!hbMeses||_hbMesesAno!==ano){hbMeses=mesesDoAno(ano);_hbMesesAno=ano;}
  return hbMeses;
}
export function toggleHbMes(m){
  const ano=hbAnoSel(), sel=hbMesesSel(ano), i=sel.indexOf(m);
  if(i>=0){ if(sel.length===1)return; sel.splice(i,1); } else sel.push(m);
  sel.sort((a,b)=>a-b); vHabitos();
}
export function setHbMeses(modo){
  const ano=hbAnoSel(), hoje=new Date(), atual=ano===hoje.getFullYear()?hoje.getMonth():11;
  if(modo==='ano')hbMeses=[0,1,2,3,4,5,6,7,8,9,10,11];
  else if(modo==='ate')hbMeses=mesesDoAno(ano);
  else if(modo==='tri')hbMeses=[atual-2,atual-1,atual].filter(m=>m>=0);
  else if(modo==='mes')hbMeses=[atual];
  _hbMesesAno=ano; vHabitos();
}
export function hbMesFiltro(){
  const ano=hbAnoSel(), sel=hbMesesSel(ano);
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:10px 0 4px">
    <span style="font-size:11px;color:var(--faint);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Meses</span>
    ${MESES_ABR.map((n,i)=>`<button class="chip" onclick="toggleHbMes(${i})"
      style="${sel.includes(i)?'background:var(--purple);color:#fff':'background:var(--card-2);color:var(--muted);border:1px solid var(--line)'}">${n}</button>`).join('')}
    <span style="width:1px;height:18px;background:var(--line);margin:0 2px"></span>
    <button class="chip" onclick="setHbMeses('ano')" style="background:var(--card-2);color:var(--muted);border:1px solid var(--line)">ano todo</button>
    <button class="chip" onclick="setHbMeses('ate')" style="background:var(--card-2);color:var(--muted);border:1px solid var(--line)">até hoje</button>
    <button class="chip" onclick="setHbMeses('tri')" style="background:var(--card-2);color:var(--muted);border:1px solid var(--line)">3 meses</button>
    <button class="chip" onclick="setHbMeses('mes')" style="background:var(--card-2);color:var(--muted);border:1px solid var(--line)">só este mês</button>
  </div>`;
}
export function hbMiniMes(hb,ano,mes){
  const hoje=todayISO();
  const first=new Date(ano,mes,1), off=(first.getDay()+6)%7, ndias=new Date(ano,mes+1,0).getDate();
  let feitos=0, esperados=0, cells='';
  for(let i=0;i<off;i++)cells+='<div class="mm-d pad"></div>';
  for(let d=1;d<=ndias;d++){
    const iso=`${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(iso>hoje){cells+=`<div class="mm-d fut">${d}</div>`;continue;}
    const on=habitDone(hb.id,iso), esp=hbDiaEsperado(hb,iso);
    if(on)feitos++; if(esp!==false)esperados++;
    let cls='mm-d', st='';
    if(on){cls+=' on';st=`background:${hb.cor};border-color:${hb.cor}`;}
    else if(esp===true)cls+=' miss';
    else if(esp===false)cls+=' off';
    if(iso===hoje)cls+=' today';
    if(hb.auto)cls+=' ro';
    const tip=`${fmtBR(iso)} · ${on?'feito':esp===false?'folga programada':'não feito'}${hb.auto?' (automático)':''}`;
    cells+=`<div class="${cls}" style="${st}" title="${h(tip)}" ${hb.auto?'':`onclick="toggleHabito('${hb.id}','${iso}')"`}>${d}</div>`;
  }
  const pct=esperados?Math.round(feitos/esperados*100):0;
  return `<div class="mm">
    <div class="mm-h"><span>${MESES_ABR[mes]}</span><small title="${feitos} de ${esperados} dias esperados">${feitos}/${esperados} · ${pct}%</small></div>
    <div class="mm-g">${['S','T','Q','Q','S','S','D'].map(x=>`<div class="mm-wd">${x}</div>`).join('')}</div>
    <div class="mm-g" style="margin-top:3px">${cells}</div>
  </div>`;
}
export function hbGridMeses(hb,ano){
  const sel=hbMesesSel(ano);
  return `<div class="mm-wrap">${sel.map(m=>hbMiniMes(hb,ano,m)).join('')}</div>`;
}

/* ---- grade do ano inteiro (histórico, somente leitura) ---- */
export function hbGridAno(hb,ano){
  const START=ano+'-01-01', END=ano+'-12-31', hoje=todayISO();
  const s=new Date(START+'T12:00'); s.setDate(s.getDate()-((s.getDay()+6)%7));
  const end=new Date(END+'T12:00');
  const cols=[]; let cur=new Date(s);
  while(cur<=end){const wk=[];for(let i=0;i<7;i++){const d=new Date(cur);d.setDate(d.getDate()+i);wk.push(localISO(d));}cols.push(wk);cur.setDate(cur.getDate()+7);}
  const mA=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  let prevM=-1;
  const monthRow=cols.map(w=>{const m=new Date(w[0]+'T12:00').getMonth();let l='';if(m!==prevM){l=mA[m];prevM=m;}return `<div class="hm-mcol">${l}</div>`;}).join('');
  const grid=cols.map(w=>`<div class="hm-col">${w.map(iso=>{
      if(iso<START||iso>END||iso>hoje)return `<div class="hm-cell out"></div>`;
      const on=habitDone(hb.id,iso), esp=hbDiaEsperado(hb,iso);
      const stl=on?`background:${hb.cor};border-color:transparent`:(esp===true?'border-style:dashed;border-color:var(--red);opacity:.5':'opacity:.4');
      return `<div class="hm-cell" title="${fmtBR(iso)} · ${on?'feito':esp===false?'folga programada':'não feito'}" style="${stl}"></div>`;
    }).join('')}</div>`).join('');
  const wd=['S','T','Q','Q','S','S','D'];
  return `<div class="hm-wrap" style="margin:10px 0"><div style="display:flex;gap:6px">
      <div class="hm-wd">${wd.map(x=>`<span>${x}</span>`).join('')}</div>
      <div style="min-width:0"><div class="hm-row hm-months">${monthRow}</div><div class="hm-row">${grid}</div></div>
    </div></div>`;
}
export function diasAtivosAno(ano){
  // "dia ativo" = dia em que ao menos um hábito conta como feito, pela MESMA regra da tela
  // (inclusive limiar de minutos e exclusões do hábito automático). Antes, qualquer log
  // contável marcava o dia como ativo, mesmo abaixo do limiar — as duas métricas divergiam.
  ano=ano||new Date().getFullYear();const y=String(ano);
  const cand=new Set();
  Object.keys(store.habitLog).forEach(iso=>{if(iso.startsWith(y))cand.add(iso);});
  Object.keys(dayLogIndex()).forEach(iso=>{if(iso.startsWith(y))cand.add(iso);});
  let n=0;
  cand.forEach(iso=>{ if(store.habitos.some(hb=>habitDone(hb.id,iso))) n++; });
  return n;}

/* ---- risco de quebra (alimenta o Dashboard) ---- */
export function hbRiscos(){
  const out=[], hoje=todayISO(), hora=new Date().getHours();
  const diasRest=7-((new Date().getDay()+6)%7);   // inclui hoje
  store.habitos.forEach(hb=>{
    if(hb.auto||habitDone(hb.id,hoje))return;
    const f=hbFreq(hb);
    if(f==='semanal'||f==='dias'){
      const alvo=hbAlvoSemana(hb), feitos=hbFeitosNaSemana(hb,localISO(anMonday(0)));
      if(feitos>=alvo)return;
      const faltam=alvo-feitos;
      if(faltam>diasRest) out.push({hb,txt:`${feitos}/${alvo} e só restam ${diasRest} dia${diasRest>1?'s':''} — a meta da semana já não fecha`,crit:true});
      else if(faltam===diasRest) out.push({hb,txt:`${feitos}/${alvo} — precisa fazer todos os ${diasRest} dias restantes`,crit:true});
      else if(hora>=20&&hbDiaEsperado(hb,hoje)!==false) out.push({hb,txt:`${feitos}/${alvo} nesta semana`,crit:false});
    }else{
      const st=hbStreak(hb).n;
      if(st>=5&&hora>=20) out.push({hb,txt:`sequência de ${st} dias em risco`,crit:st>=10});
    }
  });
  return out.sort((a,b)=>(b.crit?1:0)-(a.crit?1:0));
}

/* ---- correlação hábito × horas estudadas ---- */
export function hbImpacto(hb,dias){
  dias=dias||60;
  const hoje=todayISO(), com=[], sem=[];
  for(let i=1;i<=dias;i++){const iso=addDaysISO(hoje,-i);
    (habitDone(hb.id,iso)?com:sem).push(hoursOnDay(iso));}
  if(com.length<10||sem.length<10)return null;      // n pequeno demais: não mostra número
  const md=a=>a.reduce((x,y)=>x+y,0)/a.length;
  return {com:md(com),sem:md(sem),nCom:com.length,nSem:sem.length};
}

/* ---- heatmap de 8 semanas, clicável (permite corrigir dias antigos) ---- */
export function hbHeatmap(hb){
  const hoje=todayISO(), sems=[];
  for(let i=7;i>=0;i--)sems.push(localISO(anMonday(-i)));
  const wd=['S','T','Q','Q','S','S','D'];
  const head=wd.map(x=>`<span>${x}</span>`).join('');
  const linhas=sems.map(mon=>semanaDias(mon).map(iso=>{
    const futuro=iso>hoje, on=!futuro&&habitDone(hb.id,iso), esp=hbDiaEsperado(hb,iso);
    let cls='hh-cell', st='';
    if(futuro)cls+=' fut';
    else if(on){cls+=' on';st=`background:${hb.cor};border-color:${hb.cor}`;}
    else if(esp===true)cls+=' miss';
    else if(esp===false)cls+=' off';
    if(iso===hoje)cls+=' today';
    if(hb.auto)cls+=' ro';
    const tip=fmtBR(iso)+' · '+(futuro?'—':on?'feito':esp===false?'folga programada':'não feito')+(hb.auto?' (automático)':'');
    return `<div class="${cls}" style="${st}" title="${h(tip)}" ${(hb.auto||futuro)?'':`onclick="toggleHabito('${hb.id}','${iso}')"`}></div>`;
  }).join('')).join('');
  return `<div class="hh"><div class="hh-head">${head}</div><div class="hh-grid">${linhas}</div>
    <div class="hh-legend">8 semanas · ${hb.auto?'somente leitura':'toque em qualquer dia para corrigir'}</div></div>`;
}

export function dashHabitChips(){
  if(!store.habitos.length)return '<div class="empty" style="padding:14px">Nenhum hábito ainda. <button class="btn sm ghost" onclick="go(\'habitos\')">Criar</button></div>';
  const t=todayISO(), mon=localISO(anMonday(0));
  return `<div class="hist-chips">`+store.habitos.map(hb=>{const on=habitDone(hb.id,t);
    const f=hbFreq(hb);
    const prog=(f==='semanal'||f==='dias')?` ${Math.min(hbAlvoSemana(hb),hbFeitosNaSemana(hb,mon))}/${hbAlvoSemana(hb)}`:'';
    return `<button class="chip" onclick="toggleHabito('${hb.id}')" title="${h(hb.nome+' · '+hbLabelFreq(hb)+(hb.auto?' · automático':''))}"
      style="${on?`background:${hb.cor}22;color:${hb.cor}`:'background:var(--card-2);color:var(--muted);border:1px solid var(--line)'}">
      ${hb.icon||''} ${h(hb.nome)}${prog} ${on?'✓':''}</button>`;}).join('')+`</div>`;
}
export function dashHabitRiscos(){
  const r=hbRiscos(); if(!r.length)return '';
  return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">${r.slice(0,4).map(x=>
    `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:7px 10px;border-radius:9px;
      background:${x.crit?'var(--red-soft)':'var(--amber-soft)'};color:${x.crit?'var(--red)':'var(--amber)'}">
      <span>${x.crit?'⚠':'⏳'}</span><b>${h(x.hb.nome)}</b><span style="opacity:.85">${h(x.txt)}</span></div>`).join('')}</div>`;
}

export let hbAno=null;
export function setHbAno(y){hbAno=+y;vHabitos();}
export function hbAnoSel(){ if(!hbAno||!anosComDado().includes(hbAno)) hbAno=anoAtual(); return hbAno; }
/* ---------------- Estante (livros lidos) ----------------
   Vive em store.livros e aparece dentro do card do hábito marcado com `livros:true`.
   Ligar por flag e não pelo id 'h_leitura' evita órfãos se o hábito for renomeado
   ou recriado, e permite mais de uma estante no futuro sem tocar nesta função. */

export function vHabitos(){
  const total=store.habitos.length;
  const hoje=todayISO(), mon=localISO(anMonday(0));
  const ano=hbAnoSel(), ehAtual=ano===anoAtual();
  const melhor=store.habitos.reduce((mx,hb)=>{const s=hbStreak(hb);return s.n>mx.n?s:mx;},{n:0,un:'d'});
  const marcAno=store.habitos.reduce((s,hb)=>s+habitYearCount(hb.id,ano),0);
  const ativosAno=diasAtivosAno(ano);
  const riscos=ehAtual?hbRiscos():[];

  const rowsHoje=store.habitos.map(hb=>{const on=habitDone(hb.id,hoje);
    const f=hbFreq(hb), alvo=hbAlvoSemana(hb), feitos=hbFeitosNaSemana(hb,mon);
    const esperadoHoje=hbDiaEsperado(hb,hoje);
    const sub=hb.auto?`automático · Diário de Bordo${hb.minMin>1?` · mín. ${hb.minMin}min/dia`:''}`
      :(f==='diario'?'todo dia':`${hbLabelFreq(hb)} · ${Math.min(alvo,feitos)}/${alvo} esta semana`);
    return `<div class="habit-toggle ${hb.auto?'auto':''}" ${hb.auto?'':`onclick="toggleHabito('${hb.id}')"`}
      style="${on?`background:${hb.cor}18;border-color:${hb.cor}55`:''}">
      <div class="habit-ic" style="background:${hb.cor}22;color:${hb.cor}">${hb.icon||'•'}</div>
      <div class="habit-name">${h(hb.nome)}${esperadoHoje===false&&!on?' <span class="pill gray" style="font-size:10px">folga hoje</span>':''}<small>${h(sub)}</small></div>
      <div class="habit-mark" style="${on?`background:${hb.cor};border-color:${hb.cor}`:''}">${on?'✓':''}</div>
    </div>`;}).join('');

  const stats=store.habitos.map(hb=>{
    const tx=hbTaxa(hb), st=hbStreak(hb);
    const yc=habitYearCount(hb.id,ano), ybs=hbMelhorSequencia(hb,ano);
    const rColor=tx.pct>=80?'green':tx.pct>=50?'amber':'red';
    const alvo=hbAlvoSemana(hb), feitos=Math.min(alvo,hbFeitosNaSemana(hb,mon));
    const semanal=hbFreq(hb)!=='diario';
    const imp=hb.auto?null:hbImpacto(hb);
    return `<div class="habit-stat">
      <div class="hs-head">
        <div class="hs-name"><span class="tag-dot" style="background:${hb.cor}"></span>${hb.icon||''} ${h(hb.nome)}</div>
        <div class="hs-freq">${h(hbLabelFreq(hb))}</div>
      </div>
      ${hbGridMeses(hb,ano)}
      <div class="hs-metrics">
        ${ehAtual?`<span class="pill ${st.n>0?'purple':'gray'}" title="${st.un==='sem'?'Semanas consecutivas cumprindo o alvo':'Dias esperados consecutivos — folgas programadas não quebram'}">🔥 ${st.n}${st.un==='sem'?(st.n===1?' semana':' semanas'):'d'}</span>
        <span class="pill ${rColor}" title="${tx.feitos} de ${tx.esp} esperados nas últimas ${tx.janela}">${tx.pct}% · ${tx.janela}</span>
        ${semanal?`<span class="pill ${feitos>=alvo?'green':'blue'}">${feitos}/${alvo} esta semana</span>`:''}`:''}
        <span class="pill blue">📅 ${yc}× em ${ano}</span>
        <span class="pill gray" title="Sequências que atravessam a virada do ano são contadas por inteiro, não partidas em 1º de janeiro">🏆 melhor: ${ybs.n}${ybs.un==='sem'?(ybs.n===1?' semana':' semanas'):'d'}${ybs.cruza?' *':''}</span>
        <span style="margin-left:auto;display:flex;gap:4px">
          <button class="icon-btn" onclick="mHabito('${hb.id}')" title="Editar">✎</button>
          ${hb.auto?'':`<button class="icon-btn" onclick="delHabito('${hb.id}')" title="Excluir">✕</button>`}
        </span>
      </div>
      ${hb.livros?hbEstante(hb,ano):''}
      ${ehAtual&&imp?`<div class="hs-imp">
        📊 Dias <b>com</b> ${h(hb.nome.toLowerCase())}: <b style="color:var(--ink)">${fmtDur(imp.com)}</b> de estudo em média ·
        <b>sem</b>: <b style="color:var(--ink)">${fmtDur(imp.sem)}</b>
        <span style="opacity:.7">(${imp.nCom}/${imp.nSem} dias · correlação, não causa)</span></div>`:''}
    </div>`;}).join('');

  document.getElementById('view').innerHTML=`
    <div class="page-title">hábitos</div>
    <div class="page-sub">Cada hábito tem uma <b>frequência-alvo</b>, e a taxa é calculada sobre os dias <b>esperados</b> — não sobre dias corridos. Treinar 3× por semana com alvo 3 é 100%, não 43%. Os mini-calendários abaixo cobrem o ano inteiro, mês a mês, e são clicáveis: dá para corrigir qualquer dia passado.</div>

    ${riscos.length?`<div class="card" style="margin-bottom:18px;border:1px solid ${riscos[0].crit?'var(--red)':'var(--amber)'};background:${riscos[0].crit?'var(--red-soft)':'var(--amber-soft)'}">
      <h3 style="color:${riscos[0].crit?'var(--red)':'var(--amber)'}">Atenção hoje</h3>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:8px">${riscos.map(x=>
        `<div style="font-size:13px"><b>${x.crit?'⚠':'⏳'} ${h(x.hb.nome)}</b> — ${h(x.txt)}</div>`).join('')}</div>
    </div>`:''}

    ${anosComDado().length>1?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 14px">
      ${anosComDado().map(a=>`<button class="area-tab ${a===ano?'active':''}" style="padding:5px 14px;font-size:12px" onclick="setHbAno(${a})">${a}</button>`).join('')}
    </div>`:''}
    <div class="stat-row" style="margin-bottom:22px">
      <div class="stat"><b>${marcAno}</b><span>marcações em ${ano}</span></div>
      <div class="stat" title="Dias em que ao menos um hábito contou como feito — mesma regra da tela, incluindo o limiar de minutos do hábito automático"><b>${ativosAno}</b><span>dias com hábito em ${ano}</span></div>
      <div class="stat"><b>🔥 ${ehAtual?melhor.n+(melhor.un==='sem'?' sem':''):'—'}</b><span>${ehAtual?'maior sequência atual':'ano encerrado'}</span></div>
    </div>
    ${ehAtual?`<div style="display:flex;align-items:center;margin-bottom:14px">
      <h3 style="font-size:16px">Marcar</h3>
      <button class="btn sm" style="margin-left:auto" onclick="mHabito()">+ Novo hábito</button>
    </div>
    <div class="card" style="margin-bottom:20px">
      ${total?rowsHoje:'<div class="empty">Nenhum hábito cadastrado.<br><button class="btn sm ghost" style="margin-top:12px" onclick="mHabito()">Criar primeiro hábito</button></div>'}
    </div>`:`<div class="card" style="margin-bottom:20px;background:var(--card-2)">
      <div style="font-size:13px;color:var(--muted)">Visão histórica de <b>${ano}</b>. Taxa, streak atual e alertas são métricas do presente e não fazem sentido num ano encerrado — mas os mini-calendários continuam clicáveis, caso você precise corrigir algum dia.</div>
    </div>`}
    ${total?`<div class="card"><h3>Consistência · ${ano}</h3>
      <div class="h-sub">Cor cheia = feito · contorno tracejado = dia esperado e não feito · cinza claro = folga programada${ehAtual?'':' · <b>*</b> = sequência que atravessa a virada do ano'}</div>
      ${hbMesFiltro()}
      ${stats}</div>`:''}`;
}

export function distinctCountableAtividades(){
  const set=new Set();
  store.grade.forEach(g=>{if(areaById(g.area).conta&&g.atividade)set.add(g.atividade.trim());});
  store.logs.forEach(l=>{if(areaById(l.area).conta&&l.atividade)set.add(l.atividade.trim());});
  return [...set].sort((a,b)=>a.localeCompare(b));
}
export let _mhExcl=[], _mhDias=[];   // seleção temporária do modal
export function renderExclChips(){
  const list=distinctCountableAtividades();
  if(!list.length)return '<div style="font-size:12px;color:var(--faint)">Sem atividades registradas ainda.</div>';
  return list.map((a,i)=>{const on=_mhExcl.some(x=>x.toLowerCase()===a.toLowerCase());
    return `<button type="button" class="chip" onclick="toggleMhExcl(${i})"
      style="${on?'background:var(--red-soft);color:var(--red)':'background:var(--card-2);color:var(--muted);border:1px solid var(--line)'}">${on?'✕ ':''}${h(a)}</button>`;}).join('');
}
export function toggleMhExcl(i){const list=distinctCountableAtividades();const a=list[i];if(a==null)return;
  const idx=_mhExcl.findIndex(x=>x.toLowerCase()===a.toLowerCase());
  if(idx>=0)_mhExcl.splice(idx,1); else _mhExcl.push(a);
  const box=document.getElementById('mhExclBox');if(box)box.innerHTML=renderExclChips();}
export function renderDiaChips(){
  const wd=['dom','seg','ter','qua','qui','sex','sáb'];
  return [1,2,3,4,5,6,0].map(d=>{const on=_mhDias.includes(d);
    return `<button type="button" class="chip" onclick="toggleMhDia(${d})"
      style="${on?'background:var(--purple);color:#fff':'background:var(--card-2);color:var(--muted);border:1px solid var(--line)'}">${wd[d]}</button>`;}).join('');
}
export function toggleMhDia(d){const i=_mhDias.indexOf(d); if(i>=0)_mhDias.splice(i,1); else _mhDias.push(d);
  const box=document.getElementById('mhDiasBox'); if(box)box.innerHTML=renderDiaChips();}
export function mhFreqChange(v){
  document.getElementById('mhAlvoWrap').style.display = v==='semanal'?'block':'none';
  document.getElementById('mhDiasWrap').style.display = v==='dias'?'block':'none';
}
export function mHabito(id=null){
  const hb=id?store.habitos.find(x=>x.id===id):null;
  _mhExcl = hb&&Array.isArray(hb.excluir)?[...hb.excluir]:[];
  _mhDias = hb&&Array.isArray(hb.dias)?[...hb.dias]:[1,3,5];
  const f=hb?hbFreq(hb):'diario';
  const paletteEmojis=['🏃','🏋️','📖','📚','💧','🧘','🍎','😴','✍️','🎧','☀️','🙏'];
  modal(`<h3>${hb?'Editar hábito':'Novo hábito'}</h3>
    <div class="field"><label>Nome</label><input id="hbn" placeholder="Ex: Meditar" value="${hb?h(hb.nome):''}"></div>
    <div class="grid2">
      <div class="field"><label>Ícone (emoji)</label><input id="hbi" maxlength="2" value="${hb?h(hb.icon||''):''}" placeholder="🏃"></div>
      <div class="field"><label>Cor</label><input type="color" id="hbc" value="${hb?(hb.cor||'#7c3aed'):'#7c3aed'}" style="height:40px;padding:4px"></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 14px">
      ${paletteEmojis.map(e=>`<button type="button" class="chip" style="font-size:16px;padding:4px 9px" onclick="document.getElementById('hbi').value='${e}'">${e}</button>`).join('')}
    </div>

    <div class="field"><label>Frequência-alvo</label>
      <select id="hbf" onchange="mhFreqChange(this.value)">
        <option value="diario" ${f==='diario'?'selected':''}>Todo dia</option>
        <option value="semanal" ${f==='semanal'?'selected':''}>X vezes por semana (dias livres)</option>
        <option value="dias" ${f==='dias'?'selected':''}>Dias fixos da semana</option>
      </select>
      <div style="font-size:11px;color:var(--faint);margin-top:6px">É isso que define o denominador da taxa e a unidade do streak. Escolher errado aqui deixa a métrica mentindo.</div>
    </div>
    <div id="mhAlvoWrap" class="field" style="display:${f==='semanal'?'block':'none'}">
      <label>Quantas vezes por semana</label>
      <select id="hbalvo">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${(hb&&hb.alvo||3)===n?'selected':''}>${n}× por semana</option>`).join('')}</select>
    </div>
    <div id="mhDiasWrap" class="field" style="display:${f==='dias'?'block':'none'}">
      <label>Dias esperados</label>
      <div id="mhDiasBox" style="display:flex;flex-wrap:wrap;gap:6px">${renderDiaChips()}</div>
    </div>

    <label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--muted);cursor:pointer;margin-bottom:10px">
      <input type="checkbox" id="hblv" ${hb&&hb.livros?'checked':''} style="width:auto">
      📚 Estante — registrar os livros lidos (título, autor, páginas e mês) dentro deste hábito
    </label>
    <label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--muted);cursor:pointer;margin-bottom:4px">
      <input type="checkbox" id="hba" ${hb&&hb.auto?'checked':''} style="width:auto"
        onchange="document.getElementById('mhAutoWrap').style.display=this.checked?'block':'none'">
      Automático — marca sozinho a partir do Diário de Bordo (recomendado só para "Estudo")
    </label>
    <div id="mhAutoWrap" style="display:${hb&&hb.auto?'block':'none'};border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
      <div class="field"><label>Mínimo de minutos no dia para contar</label>
        <input type="number" id="hbmin" min="1" step="5" value="${hb&&hb.minMin?hb.minMin:60}">
        <div style="font-size:11px;color:var(--faint);margin-top:6px">Sem limiar o hábito marca em 100% dos dias e deixa de informar qualquer coisa. 60min separa "dia de estudo" de "abri o Busuu".</div>
      </div>
      <div class="h-sub" style="margin-bottom:8px">Atividades que <b>NÃO</b> contam para o limiar (toque para excluir os microdrills):</div>
      <div id="mhExclBox" style="display:flex;flex-wrap:wrap;gap:6px">${renderExclChips()}</div>
    </div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="saveHabito(${hb?`'${id}'`:'null'})">${hb?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('hbn').focus(),50);
}
export function saveHabito(id){
  const nome=document.getElementById('hbn').value.trim(); if(!nome){toast('Dê um nome ao hábito');return;}
  const auto=document.getElementById('hba').checked;
  const freq=document.getElementById('hbf').value;
  if(freq==='dias'&&!_mhDias.length){toast('Escolha ao menos um dia da semana');return;}
  const dados={nome,icon:document.getElementById('hbi').value.trim(),
    cor:document.getElementById('hbc').value,auto,
    excluir:auto?_mhExcl.slice():[],
    minMin:auto?Math.max(1,+document.getElementById('hbmin').value||60):0,
    freq, alvo:freq==='semanal'?+document.getElementById('hbalvo').value||3:0,
    dias:freq==='dias'?_mhDias.slice().sort():[],
    livros:document.getElementById('hblv').checked};
  if(id){Object.assign(store.habitos.find(x=>x.id===id),dados);}
  else{store.habitos.push({id:uid(),...dados});}
  save();closeModal();vHabitos();toast(id?'Hábito atualizado':'Hábito adicionado');
}
export function delHabito(id){
  const hb=store.habitos.find(x=>x.id===id); if(!hb)return;
  if(!confirm('Excluir "'+hb.nome+'"? O histórico de marcações também será removido.'))return;
  store.habitos=store.habitos.filter(x=>x.id!==id);
  Object.keys(store.habitLog).forEach(iso=>{if(store.habitLog[iso]){delete store.habitLog[iso][id];
    if(!Object.keys(store.habitLog[iso]).length)delete store.habitLog[iso];}});
  save();vHabitos();toast('Hábito excluído');
}


/* setters: outros módulos não podem reatribuir um binding importado */
export function __set_hbAno(v){ hbAno=v; return v; }
