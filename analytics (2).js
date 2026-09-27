// views/analytics/analytics.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS } from '../../core/constantes.js';
import { store } from '../../core/store.js';
import { durH, fmtBR, fmtDur, todayISO } from '../../core/datas.js';
import { countableLogs, hoursThisWeek } from '../../core/horas.js';
import { h } from '../../ui/base.js';
import { addDaysISO, anDias, anoAncora, anoAtual, anoSel, anosComDado, cardHorasPorArea, chartLegend, hLbl, hoursOnDay, hoursRangeByArea, lastNDays, monthStarts, movAvg, segsFromMap, somaDias, studyHeatmap, svgColChart, trabalhoAnalyticsCard, trendPill, weekStarts } from './graficos.js';
import { cardSaida } from './output.js';

export function vAnalytics(){
  const y=anoSel(), hoje=todayISO(), anc=anoAncora(y), ehAtual=y===anoAtual();
  const doAno=l=>String(l.data||'').startsWith(String(y));
  const logsAno=countableLogs().filter(doAno);
  const total=logsAno.reduce((s,l)=>s+durH(l.ini,l.fim),0);
  const byArea={}; logsAno.forEach(l=>{byArea[l.area]=(byArea[l.area]||0)+durH(l.ini,l.fim);});
  const areasComH=AREAS.filter(a=>a.conta);

  /* ---------- diário ---------- */
  const dias=lastNDays(anDias,anc);
  const vDia=dias.map(hoursOnDay);
  const mm=movAvg(vDia,7);
  const wdL=['D','S','T','Q','Q','S','S'];
  const ptsDia=dias.map((iso,i)=>({
    lbl:iso.slice(8,10)+'/'+iso.slice(5,7), sub:wdL[new Date(iso+'T12:00').getDay()],
    v:vDia[i], parcial:iso===hoje, destaque:iso===hoje,
    tip:fmtBR(iso)+' · '+(vDia[i]>0?fmtDur(vDia[i]):'sem estudo')+(iso===hoje?' (dia em curso)':'')
  }));
  // tendência: 7 dias completos vs os 7 anteriores (hoje fica de fora — está incompleto)
  const fim7=addDaysISO(anc,ehAtual?-1:0);
  const m7=somaDias(addDaysISO(fim7,-6),7)/7, m7ant=somaDias(addDaysISO(fim7,-13),7)/7;
  const diasComEstudo=vDia.filter(v=>v>0).length;
  const mediaJanela=vDia.reduce((a,b)=>a+b,0)/anDias;
  const melhorIdx=vDia.indexOf(Math.max(...vDia));

  /* ---------- semanal ---------- */
  const wks=weekStarts(y);
  const ptsSem=wks.map(mon=>{const fim=addDaysISO(mon,6);
    const mapa=hoursRangeByArea(mon,fim); const tot=Object.values(mapa).reduce((a,b)=>a+b,0);
    const parcial=fim>=hoje;
    return {lbl:mon.slice(8,10)+'/'+mon.slice(5,7), v:tot, segs:segsFromMap(mapa), parcial,
      tip:'Semana '+fmtBR(mon).slice(0,5)+'–'+fmtBR(fim).slice(0,5)+' · '+fmtDur(tot)+(parcial?' (em curso)':'')};});
  const semCompletas=ptsSem.filter(p=>!p.parcial);
  const semAtual=ptsSem.length?ptsSem[ptsSem.length-1].v:0;
  const sUlt=semCompletas.length?semCompletas[semCompletas.length-1].v:0;
  const sPen=semCompletas.length>1?semCompletas[semCompletas.length-2].v:0;
  const metasBatidas=semCompletas.filter(p=>store.metaSemanal>0&&p.v>=store.metaSemanal).length;

  /* ---------- mensal ---------- */
  const mss=monthStarts(y);
  const mAbbr=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const mesAtual=ehAtual?hoje.slice(0,7):'';
  const ptsMes=mss.map(mk=>{const ini=mk+'-01', fim=mk+'-'+String(new Date(+mk.slice(0,4),+mk.slice(5,7),0).getDate()).padStart(2,'0');
    const tot=Object.values(hoursRangeByArea(ini,fim)).reduce((a,b)=>a+b,0);
    const parcial=mk===mesAtual;
    return {lbl:mAbbr[+mk.slice(5,7)-1]+'/'+mk.slice(2,4), v:tot, parcial,
      tip:mAbbr[+mk.slice(5,7)-1]+'/'+mk.slice(0,4)+' · '+fmtDur(tot)+(parcial?' (mês em curso)':'')};});
  const mesesCompletos=ptsMes.filter(p=>!p.parcial);
  const mUlt=mesesCompletos.length?mesesCompletos[mesesCompletos.length-1].v:0;
  const mPen=mesesCompletos.length>1?mesesCompletos[mesesCompletos.length-2].v:0;
  // projeção do mês corrente
  const diaDoMes=+hoje.slice(8,10), diasNoMes=new Date(+hoje.slice(0,4),+hoje.slice(5,7),0).getDate();
  const totMesAtual=ptsMes.length&&ptsMes[ptsMes.length-1].parcial?ptsMes[ptsMes.length-1].v:0;
  const projMes=diaDoMes>0?totMesAtual/diaDoMes*diasNoMes:0;

  const legArea=chartLegend(areasComH.filter(a=>(byArea[a.id]||0)>0).map(a=>({cor:a.cor,nome:a.nome})));

  document.getElementById('view').innerHTML=`
    <div class="page-title">analytics</div>
    ${anosComDado().length>1?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 14px">
      ${anosComDado().map(a=>`<button class="area-tab ${a===y?'active':''}" style="padding:5px 14px;font-size:12px" onclick="setAnAno(${a})">${a}</button>`).join('')}
    </div>`:''}
    <div class="page-sub">Colunas em ordem cronológica, com média móvel de 7 dias no diário e a linha da meta no semanal. Colunas hachuradas são períodos <b>em curso</b> — elas ficam de fora do cálculo de tendência, senão todo dia 17 pareceria uma queda. O TRE não entra em nenhum gráfico de estudo: tem bloco próprio no fim da página.</div>

    <div class="stat-row" style="margin-bottom:20px">
      <div class="stat"><b>${fmtDur(total)}</b><span>estudadas em ${y}</span></div>
      <div class="stat"><b>${ehAtual?fmtDur(hoursThisWeek()):fmtDur(total/Math.max(1,wks.length))}</b><span>${ehAtual?'esta semana':'média por semana'}</span></div>
      <div class="stat"><b>${logsAno.length}</b><span>sessões em ${y}</span></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap">
        <div><h3>Ritmo diário</h3><div class="h-sub" style="margin-bottom:0">Coluna = horas do dia · linha = média móvel de 7 dias${ehAtual?' (neutraliza o efeito fim de semana)':` · encerrando em 31/12/${y}`}</div></div>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${[14,30,60].map(n=>`<button class="area-tab ${anDias===n?'active':''}" style="padding:5px 12px;font-size:12px" onclick="setAnDias(${n})">${n}d</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 6px">
        ${trendPill(m7,m7ant,'vs. 7 dias anteriores')}
        <span class="pill purple">média 7d: ${fmtDur(m7)}/dia</span>
      </div>
      ${svgColChart({pts:ptsDia,linha:mm,maxLabels:10,minColW:13,maxColW:30,h:170})}
      ${chartLegend([{cor:'var(--purple)',nome:'horas do dia'},{cor:'var(--rose)',nome:'média móvel 7d',linha:true}])}
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)">
        <span>Média na janela: <b style="color:var(--ink)">${fmtDur(mediaJanela)}/dia</b></span>
        <span>Dias com estudo: <b style="color:var(--ink)">${diasComEstudo}/${anDias}</b></span>
        <span>Melhor dia: <b style="color:var(--ink)">${vDia[melhorIdx]>0?fmtBR(dias[melhorIdx])+' · '+fmtDur(vDia[melhorIdx]):'—'}</b></span>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>Semanas · composição por área</h3>
      <div class="h-sub">Cada coluna é uma semana (Seg–Dom) empilhada por área. É aqui que se vê canibalização: o total pode continuar alto enquanto uma área some.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${trendPill(sUlt,sPen,'vs. semana anterior')}
        ${ehAtual?`<span class="pill purple">semana em curso: ${fmtDur(semAtual)}</span>`
                 :`<span class="pill purple">melhor semana: ${fmtDur(Math.max(0,...ptsSem.map(p=>p.v)))}</span>`}
        ${store.metaSemanal>0?`<span class="pill ${metasBatidas?'green':'gray'}">${metasBatidas}/${semCompletas.length} semanas na meta</span>`:''}
      </div>
      ${svgColChart({pts:ptsSem,meta:store.metaSemanal||0,metaLbl:'meta '+hLbl(store.metaSemanal||0),maxLabels:12,minColW:24,maxColW:72,maxBarW:54,minW:470,h:180})}
      ${legArea}
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>Meses</h3><div class="h-sub">Volume mensal${ehAtual?' — o mês corrente aparece hachurado com a projeção ao lado':' de '+y}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${trendPill(mUlt,mPen,'vs. mês anterior')}
        ${ehAtual?`<span class="pill purple">${mAbbr[+mesAtual.slice(5,7)-1]} até agora: ${fmtDur(totMesAtual)}</span>
        <span class="pill blue" title="Extrapolação linear do ritmo atual até o fim do mês">projeção: ${fmtDur(projMes)}</span>`
        :`<span class="pill purple">melhor mês: ${(()=>{const b=ptsMes.reduce((x,p)=>p.v>x.v?p:x,{v:-1,lbl:'—'});return b.v>0?h(b.lbl)+' · '+fmtDur(b.v):'—';})()}</span>
        <span class="pill blue">média: ${fmtDur(ptsMes.length?ptsMes.reduce((a,p)=>a+p.v,0)/ptsMes.length:0)}/mês</span>`}
      </div>
      ${svgColChart({pts:ptsMes,cor:'var(--rose)',maxLabels:12,minColW:40,maxColW:90,maxBarW:60,minW:470,h:150})}
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>Mapa de ${y}</h3><div class="h-sub">Intensidade de estudo por dia — encontre as quedas de consistência num relance${store.periodos.filter(p=>p.ini.slice(0,4)==String(y)||p.fim.slice(0,4)==String(y)).length?' · períodos letivos em '+y+': '+h(store.periodos.filter(p=>p.ini.slice(0,4)==String(y)||p.fim.slice(0,4)==String(y)).map(p=>p.nome).join(', ')):''}</div>
      ${studyHeatmap(y)}
    </div>

    ${trabalhoAnalyticsCard(y)}

    ${cardHorasPorArea(y,byArea,total)}
    ${cardSaida(y)}`;
}
