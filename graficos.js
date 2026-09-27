// views/analytics/graficos.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, areaById } from '../../core/constantes.js';
import { store } from '../../core/store.js';
import { durH, fmtBR, fmtDur, localISO, todayISO, weekKey } from '../../core/datas.js';
import { countableLogs, workHoursOnDay, workHoursRange, workLogs } from '../../core/horas.js';
import { h } from '../../ui/base.js';
import { planoPorAreaRange } from '../grade.js';
import { vAnalytics } from './analytics.js';
import { dayLogIndex } from '../habitos/habitos.js';

export function heatmapAno(y,opt){
  y=y||anoSel();
  const o=Object.assign({horas:hoursOnDay,rgb:'124,58,237',vazio:'sem estudo',
    cortes:[1,2,3],alphas:[.28,.52,.74,1],unidade:'1 dia'},opt||{});
  const START=y+'-01-01', END=y+'-12-31';
  const s=new Date(START+'T12:00'); s.setDate(s.getDate()-((s.getDay()+6)%7)); // segunda <= START
  const end=new Date(END+'T12:00');
  const cols=[]; let cur=new Date(s);
  while(cur<=end){const week=[];for(let i=0;i<7;i++){const d=new Date(cur);d.setDate(d.getDate()+i);week.push(localISO(d));}cols.push(week);cur.setDate(cur.getDate()+7);}
  const colorOf=lv=>lv?`rgba(${o.rgb},${o.alphas[lv-1]})`:'transparent';
  const shade=hh=>hh<=0?0:hh<o.cortes[0]?1:hh<o.cortes[1]?2:hh<o.cortes[2]?3:4;
  const inRange=iso=>iso>=START&&iso<=END;
  const hoje=todayISO();
  const mAbbr=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  // Rótulo só para meses que ocupam 2+ colunas: a primeira coluna costuma ser a
  // sobra de dezembro do ano anterior, e o rótulo dela colidia com "jan".
  const mesDaCol=cols.map(w=>new Date(w[0]+'T12:00').getMonth());
  const larg={}; mesDaCol.forEach((m,i)=>{const k=m+'|'+cols[i][0].slice(0,4);larg[k]=(larg[k]||0)+1;});
  let prevM=-1;
  const monthRow=cols.map((week,i)=>{const m=mesDaCol[i];let lbl='';
    if(m!==prevM){ if((larg[m+'|'+week[0].slice(0,4)]||0)>=2) lbl=mAbbr[m]; prevM=m; }
    return `<div class="hm-mcol">${lbl}</div>`;}).join('');
  const grid=cols.map(week=>`<div class="hm-col">${week.map(iso=>{
      if(!inRange(iso))return `<div class="hm-cell out"></div>`;
      const hh=o.horas(iso),lv=shade(hh);
      return `<div class="hm-cell${iso===hoje?' hm-today':''}" title="${fmtBR(iso)} · ${hh>0?fmtDur(hh):o.vazio}" style="background:${colorOf(lv)};${lv?'border-color:transparent':''}"></div>`;
    }).join('')}</div>`).join('');
  const wd=['S','T','Q','Q','S','S','D'];
  const legenda=`<div class="hm-legend">menos ${[0,1,2,3,4].map(l=>`<span class="sq" style="background:${colorOf(l)};${l?'border-color:transparent':''}"></span>`).join('')} mais · cada quadrado = ${o.unidade}</div>`;
  return `<div class="hm-wrap"><div style="display:flex;gap:6px">
      <div class="hm-wd">${wd.map(x=>`<span>${x}</span>`).join('')}</div>
      <div style="min-width:0"><div class="hm-row hm-months">${monthRow}</div><div class="hm-row">${grid}</div></div>
    </div>${legenda}</div>`;
}
export function studyHeatmap(y){return heatmapAno(y);}
export function workHeatmap(y){
  return heatmapAno(y,{horas:workHoursOnDay,rgb:'109,104,121',vazio:'sem trabalho em casa',
    cortes:[.75,1.5,3],alphas:[.34,.56,.78,1]});
}
/* ---------------- Analytics ---------------- */
export let anDias=30;                 // janela do gráfico diário
export let anAno=null;                // ano civil em foco
export function setAnDias(n){anDias=n;vAnalytics();}
export function setAnAno(y){anAno=+y;vAnalytics();}
export function anoAtual(){return new Date().getFullYear();}
export function anosComDado(){
  const set=new Set([anoAtual()]);
  Object.keys(dayLogIndex()).forEach(iso=>set.add(+iso.slice(0,4)));
  Object.keys(store.habitLog).forEach(iso=>set.add(+iso.slice(0,4)));
  store.periodos.forEach(p=>{set.add(+p.ini.slice(0,4));set.add(+p.fim.slice(0,4));});
  store.livros.forEach(lv=>set.add(+String(lv.mes).slice(0,4)));
  return [...set].sort((a,b)=>b-a);
}
export function anoSel(){ if(!anAno||!anosComDado().includes(anAno)) anAno=anoAtual(); return anAno; }
/* Âncora: no ano corrente é hoje; num ano passado é 31/12 daquele ano.
   Sem isso, "últimos 30 dias" de 2026 devolveria dias de 2027. */
export function anoAncora(y){return y===anoAtual()?todayISO():y+'-12-31';}
export function anMonday(offset){const d=new Date();const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day+offset*7);return d;}
export function hoursOnDay(iso){const arr=dayLogIndex()[iso];return arr?arr.reduce((s,l)=>s+durH(l.ini,l.fim),0):0;}
export function addDaysISO(iso,n){const d=new Date(iso+'T12:00');d.setDate(d.getDate()+n);return localISO(d);}

/* ---- séries ---- */
export function lastNDays(n,ancoraISO){const out=[];const d=new Date((ancoraISO||todayISO())+'T12:00');
  d.setDate(d.getDate()-(n-1));
  for(let i=0;i<n;i++){out.push(localISO(d));d.setDate(d.getDate()+1);}return out;}
export function movAvg(vals,w){return vals.map((_,i)=> i<w-1 ? null : vals.slice(i-w+1,i+1).reduce((a,b)=>a+b,0)/w);}
/* Séries recortadas pelo ano: o número de colunas fica limitado por construção
   (≤53 semanas, ≤12 meses), em vez de crescer até estourar um teto que descartava
   justamente as semanas mais recentes. */
export function weekStarts(y){
  y=y||anoSel();
  const d=new Date(y+'-01-01T12:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); // segunda da 1ª semana
  const limite=y===anoAtual()?localISO(anMonday(0)):y+'-12-31';
  const out=[];
  while(localISO(d)<=limite&&out.length<54){out.push(localISO(d));d.setDate(d.getDate()+7);}
  return out;
}
export function monthStarts(y){
  y=y||anoSel();
  const ultimo=y===anoAtual()?new Date().getMonth():11;
  const out=[];
  for(let m=0;m<=ultimo;m++)out.push(y+'-'+String(m+1).padStart(2,'0'));
  return out;
}
export function hoursRangeByArea(iniISO,fimISO){
  const m={};
  countableLogs().forEach(l=>{ if(l.data>=iniISO&&l.data<=fimISO) m[l.area]=(m[l.area]||0)+durH(l.ini,l.fim); });
  return m;
}
export function segsFromMap(m){
  return AREAS.filter(a=>a.conta&&(m[a.id]||0)>0).map(a=>({cor:a.cor,v:m[a.id],nome:a.nome}));
}

/* ---- escala e render ---- */
export function niceMax(v){
  const steps=[0.5,1,2,3,4,5,6,8,10,12,15,20,25,30,40,50,60,80,100,120,150,200,250,300];
  for(const s of steps) if(v<=s) return s;
  return Math.ceil(v/50)*50;
}
export function hLbl(v){return (Math.round(v*10)/10).toString().replace('.',',')+'h';}
/* cfg: {pts:[{lbl,sub,v,parcial,segs,tip}], meta, metaLbl, linha:[v|null], linhaLbl, cor, h, minColW, maxColW, maxLabels} */
export function svgColChart(o){
  const pts=o.pts||[];
  if(!pts.length) return '<div class="empty">Sem dados ainda.</div>';
  const H=o.h||168, padL=46, padR=16, padT=14, padB=o.sub2?38:26;
  let colW=Math.max(o.minColW||16,Math.min(o.maxColW||60,Math.floor(760/pts.length)));
  // com poucas colunas, espalha para preencher o card (a barra tem largura máxima própria)
  if(o.minW&&padL+padR+pts.length*colW<o.minW) colW=Math.floor((o.minW-padL-padR)/pts.length);
  const W=padL+padR+pts.length*colW;
  const maxV=niceMax(Math.max(0.5,...pts.map(p=>p.v),o.meta||0,...(o.linha||[]).map(x=>x||0))*1.08);
  const y=v=>padT+H-(v/maxV)*H;
  const gap=Math.min(12,Math.max(3,Math.round(colW*0.26)));
  const bw=Math.max(4,Math.min(o.maxBarW||64,colW-gap));
  const cx=i=>padL+i*colW+colW/2;
  const cor=o.cor||'var(--purple)';

  // grade + eixo Y
  let grid='';
  for(let g=0;g<=4;g++){const v=maxV*g/4, yy=y(v);
    grid+=`<line x1="${padL-4}" y1="${yy}" x2="${W-padR+4}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${yy+3.5}" text-anchor="end" font-size="9.5" fill="var(--faint)">${g?hLbl(v):'0'}</text>`;}

  // colunas
  const cols=pts.map((p,i)=>{
    const x=cx(i)-bw/2;
    const tip=`<title>${h(p.tip||((p.lbl||'')+' · '+(p.v>0?fmtDur(p.v):'sem estudo')))}</title>`;
    const op=p.parcial?'0.42':'1';
    if(p.segs&&p.segs.length){
      let acc=0;
      const rects=p.segs.map(sg=>{const y0=y(acc+sg.v), hh=Math.max(1,y(acc)-y(acc+sg.v)); acc+=sg.v;
        return `<rect x="${x}" y="${y0}" width="${bw}" height="${hh}" fill="${sg.cor}" opacity="${op}"/>`;}).join('');
      return `<g>${tip}${rects}${p.parcial?`<rect x="${x}" y="${y(p.v)}" width="${bw}" height="${Math.max(1,padT+H-y(p.v))}" fill="none" stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 2"/>`:''}</g>`;
    }
    if(p.v<=0) return `<g>${tip}<rect x="${x}" y="${padT+H-2}" width="${bw}" height="2" fill="var(--line)"/></g>`;
    const hh=Math.max(2,padT+H-y(p.v));
    return `<g>${tip}<rect x="${x}" y="${y(p.v)}" width="${bw}" height="${hh}" rx="2" fill="${cor}" opacity="${op}"/>
      ${p.parcial?`<rect x="${x}" y="${y(p.v)}" width="${bw}" height="${hh}" rx="2" fill="none" stroke="${cor}" stroke-width="1" stroke-dasharray="3 2"/>`:''}</g>`;
  }).join('');

  // linha de meta
  let meta='';
  if(o.meta>0&&o.meta<=maxV){const ym=y(o.meta);
    meta=`<line x1="${padL}" y1="${ym}" x2="${W-padR}" y2="${ym}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="${W-padR}" y="${ym-5}" text-anchor="end" font-size="9.5" font-weight="600" fill="var(--green)">${h(o.metaLbl||('meta '+hLbl(o.meta)))}</text>`;}

  // linha sobreposta (média móvel)
  let linha='';
  if(o.linha&&o.linha.some(v=>v!=null)){
    const segs=[]; let cur=[];
    o.linha.forEach((v,i)=>{ if(v==null){if(cur.length)segs.push(cur);cur=[];} else cur.push(`${cx(i)},${y(v)}`); });
    if(cur.length)segs.push(cur);
    linha=segs.map(s=>`<polyline points="${s.join(' ')}" fill="none" stroke="var(--rose)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
      +o.linha.map((v,i)=>v==null?'':`<circle cx="${cx(i)}" cy="${y(v)}" r="2.4" fill="var(--rose)"/>`).join('');
  }

  // rótulos do eixo X
  const step=Math.ceil(pts.length/(o.maxLabels||12));
  const labels=pts.map((p,i)=>{
    const mostra=(i%step===0)||i===pts.length-1;
    let out='';
    if(p.sub) out+=`<text x="${cx(i)}" y="${padT+H+11}" text-anchor="middle" font-size="8.5" fill="var(--faint)">${h(p.sub)}</text>`;
    if(mostra&&p.lbl) out+=`<text x="${cx(i)}" y="${padT+H+(p.sub?21:12)}" text-anchor="middle" font-size="9.5" font-weight="${p.destaque?'700':'500'}" fill="${p.destaque?'var(--purple)':'var(--muted)'}">${h(p.lbl)}</text>`;
    return out;}).join('');

  return `<div class="chart-wrap"><svg width="${W}" height="${padT+H+padB}" viewBox="0 0 ${W} ${padT+H+padB}" style="display:block" xmlns="http://www.w3.org/2000/svg">
    ${grid}${cols}${meta}${linha}${labels}</svg></div>`;
}
export function chartLegend(items){
  return `<div class="chart-legend">${items.map(it=>
    `<span><i style="background:${it.cor};${it.linha?'height:3px;border-radius:2px':''}"></i>${h(it.nome)}</span>`).join('')}</div>`;
}

/* ---- tendência ---- */
export function trendPill(cur,prev,sufixo){
  if(prev<=0) return `<span class="pill gray">sem base de comparação</span>`;
  const pct=Math.round((cur-prev)/prev*100);
  if(Math.abs(pct)<3) return `<span class="pill gray">→ estável ${sufixo}</span>`;
  const up=pct>0;
  return `<span class="pill ${up?'green':'red'}">${up?'▲':'▼'} ${Math.abs(pct)}% ${sufixo}</span>`;
}
export function somaDias(iso0,n){let s=0;for(let i=0;i<n;i++)s+=hoursOnDay(addDaysISO(iso0,i));return s;}

/* Semanas completas do ano com os dois números lado a lado. Semana em curso fica
   de fora — comparar uma semana pela metade com semanas inteiras distorce a média. */
export function semanasEstudoTrabalho(y){
  const hoje=todayISO();
  return weekStarts(y).map(mon=>{
    const fim=addDaysISO(mon,6);
    if(fim>=hoje)return null;
    const est=Object.values(hoursRangeByArea(mon,fim)).reduce((a,b)=>a+b,0);
    const trab=workHoursRange(mon,fim);
    // semanas sem lançamento nenhum são ausência de dado, não semana de estudo zero.
    // Sem esse filtro, cada semana em branco entra como "sem trabalho e 0h de estudo"
    // e derruba a média do grupo de controle até inverter o sinal da correlação.
    if(est===0&&trab===0)return null;
    return {mon,fim,est,trab};
  }).filter(Boolean);
}
export function trabalhoImpacto(y){
  const rows=semanasEstudoTrabalho(y);
  const com=rows.filter(r=>r.trab>0), sem=rows.filter(r=>r.trab===0);
  if(com.length<3||sem.length<3)return {n:false,com:com.length,sem:sem.length};
  const md=a=>a.reduce((s,r)=>s+r.est,0)/a.length;
  return {n:true,mediaCom:md(com),mediaSem:md(sem),nCom:com.length,nSem:sem.length,
          mediaTrab:com.reduce((s,r)=>s+r.trab,0)/com.length};
}
export function trabalhoAnalyticsCard(y){
  const cor=areaById('tre').cor;
  const logsAno=workLogs().filter(l=>String(l.data).startsWith(String(y)));
  if(!logsAno.length)return '';
  const total=logsAno.reduce((s,l)=>s+durH(l.ini,l.fim),0);
  const hoje=todayISO();
  const pts=weekStarts(y).map(mon=>{const fim=addDaysISO(mon,6), v=workHoursRange(mon,fim), parcial=fim>=hoje;
    return {lbl:mon.slice(8,10)+'/'+mon.slice(5,7), v, parcial,
      tip:'Semana '+fmtBR(mon).slice(0,5)+'–'+fmtBR(fim).slice(0,5)+' · '+(v>0?fmtDur(v):'sem trabalho em casa')+(parcial?' (em curso)':'')};});
  const semComTrab=pts.filter(p=>!p.parcial&&p.v>0).length;
  const imp=trabalhoImpacto(y);
  return `<div class="card" style="margin-bottom:18px;border-left:3px solid ${cor}">
    <h3>Trabalho em casa · TRE</h3>
    <div class="h-sub">Série paralela, em escala própria. Nunca somada às horas de estudo — o objetivo é ver quando o trabalho invade a semana, não celebrar volume.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span class="pill gray">${fmtDur(total)} em ${y}</span>
      <span class="pill gray">${logsAno.length} ${logsAno.length===1?'sessão':'sessões'}</span>
      <span class="pill gray">${semComTrab} ${semComTrab===1?'semana afetada':'semanas afetadas'}</span>
    </div>
    ${svgColChart({pts,cor,maxLabels:12,minColW:24,maxColW:72,maxBarW:54,minW:470,h:150})}
    <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px">
      <h3 style="font-size:15px">Mapa de ${y} · trabalho em casa</h3>
      <div class="h-sub">Mesma malha do mapa de estudo, em cinza. Sobreponha mentalmente os dois: onde os quadrados cinza aparecem, veja se os roxos sumiram.</div>
      ${workHeatmap(y)}
    </div>
    <div style="margin-top:14px;padding:11px 13px;border-radius:10px;background:var(--card-2);font-size:13px;color:var(--muted)">
      ${imp.n
        ? `📊 Semanas <b>com</b> trabalho em casa (${imp.nCom}): <b style="color:var(--ink)">${fmtDur(imp.mediaCom)}</b> de estudo em média ·
           <b>sem</b> (${imp.nSem}): <b style="color:var(--ink)">${fmtDur(imp.mediaSem)}</b>
           <div style="margin-top:6px;opacity:.85">Média de ${fmtDur(imp.mediaTrab)} de TRE nas semanas afetadas.
           ${imp.mediaCom<imp.mediaSem
             ? `Diferença de <b>${fmtDur(imp.mediaSem-imp.mediaCom)}</b> por semana — correlação, não prova de causa, mas é a ordem de grandeza do que o trabalho em casa custa em estudo.`
             : `Aqui o estudo não caiu nas semanas com trabalho — pelo dado atual, uma coisa não está comendo a outra.`}</div>`
        : `📊 Correlação com as horas de estudo ainda não é confiável: ${imp.com} ${imp.com===1?'semana':'semanas'} com trabalho e ${imp.sem} sem. Preciso de ao menos 3 de cada lado para o número não ser ruído.`}
    </div>
  </div>`;
}
/* ---- Sparkline: tendência da área nas últimas semanas, sem eixo nem rótulo.
   É contexto periférico dentro da linha — quem quiser número exato tem o gráfico
   semanal acima. Por isso não ganha grade, tooltip por ponto nem escala visível. ---- */
export function svgSpark(vals,cor,w,hh){
  w=w||92; hh=hh||28;
  if(!vals.length)return '';
  const max=Math.max(...vals,0.01), n=vals.length;
  const x=i=>n>1?(i/(n-1))*(w-2)+1:w/2;
  const y=v=>hh-2-(v/max)*(hh-6);
  const pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area=`1,${hh-1} ${pts} ${(w-1)},${hh-1}`;
  const ult=vals[n-1];
  return `<svg viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" class="spark" aria-hidden="true">
    <polygon points="${area}" fill="${cor}" opacity=".13"/>
    <polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
    <circle cx="${x(n-1).toFixed(1)}" cy="${y(ult).toFixed(1)}" r="2.4" fill="${cor}"/>
  </svg>`;
}
/* Matriz área × semana em uma passada só — evita 6 áreas × 12 semanas de varredura */
export function horasPorAreaSemana(wkKeys){
  const idx={}; wkKeys.forEach(k=>idx[k]={});
  countableLogs().forEach(l=>{const k=weekKey(l.data);
    if(idx[k])idx[k][l.area]=(idx[k][l.area]||0)+durH(l.ini,l.fim);});
  return idx;
}
export function ultimasSemanas(n,ancoraISO){
  const out=[]; let d=ancoraISO||todayISO();
  for(let i=0;i<n;i++){out.unshift(weekKey(d));d=addDaysISO(d,-7);}
  return out;
}
export function cardHorasPorArea(y,byArea,total){
  const ehAtual=y===anoAtual(), hoje=todayISO();
  const anc=ehAtual?hoje:(y+'-12-31');
  const wkKeys=ultimasSemanas(12,anc), matriz=horasPorAreaSemana(wkKeys);
  // janelas móveis de 28 dias: comparar meses-calendário faria o mês corrente,
  // sempre incompleto, aparecer como queda em todas as áreas
  const j1i=addDaysISO(anc,-27), j2i=addDaysISO(anc,-55), j2f=addDaysISO(anc,-28);
  const jAtual=hoursRangeByArea(j1i,anc), jAnt=hoursRangeByArea(j2i,j2f);
  const sess={}; countableLogs().filter(l=>String(l.data).startsWith(String(y)))
    .forEach(l=>{sess[l.area]=(sess[l.area]||0)+1;});

  const lista=AREAS.filter(a=>a.conta).map(a=>({a,v:byArea[a.id]||0}))
    .sort((x,z)=>z.v-x.v);
  const comDado=lista.filter(r=>r.v>0), semDado=lista.filter(r=>r.v===0);
  const maxV=Math.max(1,...comDado.map(r=>r.v));

  /* Plano previsto até a âncora (hoje, se for o ano corrente): comparar o ano
     inteiro incluiria semanas que ainda não aconteceram e todo mundo apareceria
     em déficit por construção. */
  const plano=planoPorAreaRange(y+'-01-01',anc);
  const temPlano=plano.totalH>0;
  const aderH=v=>v<50?'ad-bad':v<85?'ad-mid':'ad-ok';

  const faixa=comDado.length?`<div class="mix-bar" title="Composição das ${fmtDur(total)} de ${y}">
    ${comDado.map(r=>`<i style="width:${(r.v/total*100).toFixed(2)}%;background:${r.a.cor}"
      title="${h(r.a.nome)} · ${fmtDur(r.v)} · ${Math.round(r.v/total*100)}%"></i>`).join('')}
  </div>`:'';

  const linhas=comDado.map((r,i)=>{
    const pct=total>0?r.v/total*100:0;
    const cur=jAtual[r.a.id]||0, prev=jAnt[r.a.id]||0;
    const dpct=prev>0?Math.round((cur-prev)/prev*100):(cur>0?null:0);
    const seta=dpct===null?`<span class="ar new" title="Sem registro nos 28 dias anteriores">novo</span>`
      :Math.abs(dpct)<5?`<span class="ar flat" title="${fmtDur(cur)} nos últimos 28 dias vs. ${fmtDur(prev)} nos 28 anteriores">estável</span>`
      :`<span class="ar ${dpct>0?'up':'down'}" title="${fmtDur(cur)} nos últimos 28 dias vs. ${fmtDur(prev)} nos 28 anteriores">${dpct>0?'▲':'▼'} ${Math.abs(dpct)}%</span>`;
    const n=sess[r.a.id]||0;
    const vals=wkKeys.map(k=>matriz[k][r.a.id]||0);
    const meta=store.metasArea[r.a.id]||0;
    const prevH=(plano.min[r.a.id]||0)/60;
    const ader=prevH>0?r.v/prevH*100:null;
    const adLbl=ader===null?'':` · <span class="${aderH(ader)}">${Math.round(ader)}% do plano</span>`;
    const adBar=ader===null?'':`<div class="ha-ader ${aderH(ader)}"
      title="${fmtDur(r.v)} registradas de ${fmtDur(prevH)} previstas pela grade ${plano.de?'de '+fmtBR(plano.de).slice(0,5)+' a '+fmtBR(plano.ate).slice(0,5):''}"><i style="width:${Math.min(100,ader).toFixed(1)}%"></i></div>`;
    return `<div class="ha-row">
      <div class="ha-rank">${i+1}</div>
      <div class="ha-id"><i style="background:${r.a.cor}"></i><b>${h(r.a.nome)}</b>
        <small>${n} ${n===1?'sessão':'sessões'}${n?` · ${fmtDur(r.v/n)}/sessão`:''}${meta?` · meta ${hLbl(meta)}/sem`:''}${adLbl}</small></div>
      <div class="ha-bar"><div class="ha-track"><i style="width:${Math.max(1.5,r.v/maxV*100)}%;background:${r.a.cor}"></i></div>${adBar}</div>
      <div class="ha-spark" title="Últimas 12 semanas">${svgSpark(vals,r.a.cor)}</div>
      <div class="ha-num"><b>${fmtDur(r.v)}</b><small>${pct<1&&pct>0?'<1':Math.round(pct)}% do total</small></div>
      <div class="ha-delta">${seta}</div>
    </div>`;}).join('');

  /* ---- TRE em casa: agregado paralelo, renderizado FORA do ranking.
     Não entra em `total`, na mix-bar nem no % — só responde "quanto trabalho
     invadiu o ano", que hoje nenhum lugar do sistema responde em horas. ---- */
  const areaTre=AREAS.find(a=>!a.conta);
  const logsTre=workLogs().filter(l=>String(l.data).startsWith(String(y)));
  const treH=logsTre.reduce((s,l)=>s+durH(l.ini,l.fim),0);
  let rodapeTre='';
  if(areaTre&&treH>0){
    const treWk={}; wkKeys.forEach(k=>{treWk[k]=0;});
    workLogs().forEach(l=>{const k=weekKey(l.data); if(k in treWk)treWk[k]+=durH(l.ini,l.fim);});
    const treCur=workHoursRange(j1i,anc), trePrev=workHoursRange(j2i,j2f);
    const treD=trePrev>0?Math.round((treCur-trePrev)/trePrev*100):(treCur>0?null:0);
    const treSeta=treD===null?`<span class="ar new" title="Sem registro nos 28 dias anteriores">novo</span>`
      :Math.abs(treD)<5?`<span class="ar flat" title="${fmtDur(treCur)} nos últimos 28 dias vs. ${fmtDur(trePrev)} nos 28 anteriores">estável</span>`
      :`<span class="ar ${treD>0?'down':'up'}" title="${fmtDur(treCur)} nos últimos 28 dias vs. ${fmtDur(trePrev)} nos 28 anteriores">${treD>0?'▲':'▼'} ${Math.abs(treD)}%</span>`;
    const nT=logsTre.length, diasT=new Set(logsTre.map(l=>l.data)).size;
    // acima de 1× a leitura natural é "quantas vezes"; abaixo, "quantos %"
    const razao=total>0?treH/total:0;
    const razaoLbl=razao>=1
      ? (Math.round(razao*10)/10).toString().replace('.',',')+'×'
      : Math.round(razao*100)+'%';
    const razaoPrep=razao>=1?'o':'do';
    rodapeTre=`<div class="ha-work">
      <div class="ha-row">
        <div class="ha-rank" title="Fora do ranking">—</div>
        <div class="ha-id"><i style="background:${areaTre.cor}"></i><b>${h(areaTre.nome)}</b>
          <small>${nT} ${nT===1?'sessão':'sessões'} em ${diasT} ${diasT===1?'dia':'dias'}${nT?` · ${fmtDur(treH/nT)}/sessão`:''} · não conta como estudo</small></div>
        <div class="ha-bar"><div class="ha-track"><i style="width:100%"></i></div></div>
        <div class="ha-spark" title="Últimas 12 semanas">${svgSpark(wkKeys.map(k=>treWk[k]||0),areaTre.cor)}</div>
        <div class="ha-num"><b>${fmtDur(treH)}</b><small>fora do total</small></div>
        <div class="ha-delta">${treSeta}</div>
      </div>
      <div class="ha-work-note">Trabalho levado para casa em ${y}${total>0?` — <b>${razaoLbl}</b> ${razaoPrep} estudo registrado no ano`:''}. Fica fora do total, da barra de composição e do ranking. A seta está invertida de propósito: aqui, subir é piorar.</div>
    </div>`;
  }

  const zeradas=semDado.length?`<div class="ha-zero">
    Sem nenhum registro em ${y}: ${semDado.map(r=>{const pv=(plano.min[r.a.id]||0)/60;
      return `<span${pv>0?' class="ad-bad" title="'+fmtDur(pv)+' previstas pela grade e nada registrado"':''}><i style="background:${r.a.cor}"></i>${h(r.a.nome)}${pv>0?` · 0% de ${fmtDur(pv)}`:''}</span>`;}).join('')}
  </div>`:'';

  /* Cabeçalho de aderência: sem ele, os % da lista são "% do que foi registrado",
     não "% do que era pra ter sido feito" — leitura otimista por construção. */
  const adGeral=temPlano?total/plano.totalH*100:null;
  const faixaAder=temPlano?`<div class="ha-plan ${aderH(adGeral)}">
    <b>${Math.round(adGeral)}%</b> de aderência ao plano · ${fmtDur(total)} registradas de <b>${fmtDur(plano.totalH)}</b> previstas pela grade
    <small>${fmtBR(plano.de)} → ${fmtBR(plano.ate)} · ${plano.dias} ${plano.dias===1?'dia':'dias'} sob período com grade definida. Dias fora de qualquer período não geram plano e não contam como falha.</small>
  </div>`:'';

  return `<div class="card">
    <h3>Distribuição por área · ${y}</h3>
    <div class="h-sub">Ordenado por volume. A seta compara os <b>últimos 28 dias</b> com os 28 anteriores — janela móvel, para o mês em curso não puxar todas as áreas para baixo. A minissérie é o traçado das últimas 12 semanas.</div>
    ${faixa}
    ${faixaAder}
    ${comDado.length?`<div class="ha-list">${linhas}</div>`:'<div class="empty">Sem dados ainda.</div>'}
    ${rodapeTre}
    ${zeradas}
  </div>`;
}
