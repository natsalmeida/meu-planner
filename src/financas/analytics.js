// financas/analytics.js — gerado a partir do monólito; edite aqui a partir de agora.
import { todayISO } from '../core/datas.js';
import { h } from '../ui/base.js';
import { fin, finCat, finCatById } from './core.js';
import { FIN_MESES, brl, finCiclo, finCompDe, finFatKey, finFaturasDaComp, finNorm, finTodasParcelas, r2, ymAdd, ymLabel } from './util.js';
import { finCategorizar } from './voz.js';
import { FIN_ST, finEfComp, vFinancas } from './view.js';

/* ======================================================================
   ANALYTICS FINANCEIRO
   Base = a mesma do Mês: o que saiu do dinheiro de cada competência
   (contas + parcelas de cartão pela categoria de cada compra + à vista do ciclo).
   Por isso os gráficos somam exatamente o total que a aba Mês mostra.
   ====================================================================== */
export const FIN_CAT_CARTAO={id:'_cartao',nome:'Cartão (não detalhado)',cor:'#b9b3c6'};
export const finCatInfo=id=>id==='_cartao'?FIN_CAT_CARTAO:finCat(id);
export function finSaidasComp(M,ps){
  ps=ps||finTodasParcelas(); const out=[];
  fin.contas.filter(c=>c.tipo==='despesa'&&finEfComp(c)===M).forEach(c=>{
    const cat=c.cat&&finCatById(c.cat)?c.cat:finCategorizar(finNorm(c.desc)).cat;
    out.push({cat,valor:c.valor,desc:c.desc,fonte:'conta',fixo:!!c.modelo,meio:'conta'}); });
  finFaturasDaComp(M,ps).forEach(f=>{
    ps.filter(p=>p.cartao===f.cartao.id&&p.fat===f.ym).forEach(p=>out.push({cat:p.g.cat,valor:p.valor,desc:p.g.desc,fonte:'cartao',meio:'credito',parc:p.n>1}));
    if(f.informado&&Math.abs(f.valor-f.calc)>0.009) out.push({cat:'_cartao',valor:r2(f.valor-f.calc),desc:'Fatura '+f.cartao.nome+' (não detalhado)',fonte:'cartao',meio:'credito'}); });
  const ci=finCiclo(M);
  fin.gastos.filter(g=>g.meio!=='credito'&&g.data>=ci.ini&&g.data<=ci.fim)
    .forEach(g=>out.push({cat:g.cat,valor:g.valor,desc:g.desc,fonte:'avista',meio:g.meio}));
  return out;
}
export function finResumoComp(M,ps){
  const sai=finSaidasComp(M,ps), soma=a=>r2(a.reduce((s,x)=>s+x.valor,0));
  const rec=soma(fin.contas.filter(c=>c.tipo==='receita'&&c.comp===M));
  const apo=soma(fin.contas.filter(c=>c.tipo==='aporte'&&finEfComp(c)===M));
  const saidas=soma(sai);
  return {M,sai,rec,apo,saidas,sobra:r2(rec-saidas-apo),fixos:soma(sai.filter(x=>x.fixo))};
}
export const FIN_AN={per:3,fim:null};
export function finAnPer(n){FIN_AN.per=n;vFinancas();}
export function finAnFim(n){FIN_AN.fim=n===0?finCompDe(todayISO()):ymAdd(FIN_AN.fim,n);vFinancas();}
export function finHexA(hex,a){const m=hex.replace('#','').match(/.{2}/g); if(!m) return hex; const [r,g,b]=m.map(x=>parseInt(x,16)); return `rgba(${r},${g},${b},${a})`;}
export const finK=v=>{const a=Math.abs(v); return (v<0?'-':'')+(a>=1e6?(a/1e6).toFixed(1).replace('.',',')+'M':a>=1e3?(a/1e3).toFixed(a>=1e4?0:1).replace('.',',')+'k':Math.round(a));};

export function finVAnalytics(){
  if(!FIN_AN.fim) FIN_AN.fim=FIN_ST.comp||finCompDe(todayISO());
  const fim=FIN_AN.fim, N=FIN_AN.per, ps=finTodasParcelas();
  const meses=Array.from({length:N},(_,i)=>ymAdd(fim,i-N+1));
  const ant=Array.from({length:N},(_,i)=>ymAdd(fim,i-2*N+1));
  const R=meses.map(m=>finResumoComp(m,ps)), RA=ant.map(m=>finResumoComp(m,ps));
  const serie=Array.from({length:12},(_,i)=>finResumoComp(ymAdd(fim,i-11),ps));
  const primeiro=serie.findIndex(r=>r.rec||r.saidas||r.apo); const evo=primeiro<0?[]:serie.slice(primeiro);
  const tot=(arr,k)=>r2(arr.reduce((s,r)=>s+r[k],0));
  const rec=tot(R,'rec'), sai=tot(R,'saidas'), apo=tot(R,'apo'), fixos=tot(R,'fixos'), saiAnt=tot(RA,'saidas');
  if(!rec&&!sai&&!apo) return finAnNav(meses)+`<div class="card"><div class="empty">Sem dados neste período.<br>Importe a planilha ou registre gastos para ver os gráficos.</div></div>`;
  // categorias do período e do período anterior
  const agr=rs=>{const m={}; rs.forEach(r=>r.sai.forEach(x=>{m[x.cat]=(m[x.cat]||0)+x.valor;})); return m;};
  const cats=agr(R), catsA=agr(RA);
  const catList=Object.entries(cats).map(([k,v])=>[k,r2(v)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  // KPIs
  const poup=rec>0?Math.round(apo/rec*100):0, fixoPct=rec>0?Math.round(fixos/rec*100):0;
  const dSai=saiAnt>0?Math.round((sai-saiAnt)/saiAnt*100):null;
  const curYM=todayISO().slice(0,7);
  const futuras=ps.filter(p=>p.fat>curYM&&!fin.faturasPagas[finFatKey(p.cartao,p.fat)]);
  const futTot=r2(futuras.reduce((s,p)=>s+p.valor,0)), futUlt=futuras.map(p=>p.fat).sort().pop();
  const nRec=evo.filter(r=>r.rec).length, recMedia=nRec?r2(evo.reduce((s,r)=>s+r.rec,0)/nRec):0;
  // ritmo do ciclo atual (só se o período contém a competência corrente)
  let ritmo='';
  const cAtual=finCompDe(todayISO());
  if(meses.includes(cAtual)){
    const ci=finCiclo(cAtual), hoje=todayISO();
    if(hoje>=ci.ini&&hoje<=ci.fim){
      const gasto=r2(fin.gastos.filter(g=>g.meio!=='credito'&&g.data>=ci.ini&&g.data<=hoje).reduce((s,g)=>s+g.valor,0));
      const dPass=Math.round((new Date(hoje+'T12:00')-new Date(ci.ini+'T12:00'))/864e5)+1;
      const dTot=Math.round((new Date(ci.fim+'T12:00')-new Date(ci.ini+'T12:00'))/864e5)+1;
      ritmo=`<div class="fin-kpi"><span>Ritmo à vista no ciclo</span><b>${brl(r2(gasto/dPass))}/dia</b><small>no ritmo atual fecha em ${brl(r2(gasto/dPass*dTot))} · dia ${dPass} de ${dTot}</small></div>`;
    }
  }
  return finAnNav(meses)+`
    <div class="fin-kpis">
      <div class="fin-kpi"><span>Saídas no período</span><b>${brl(sai)}</b><small>${dSai==null?'sem período anterior para comparar':`${dSai>0?'▲':'▼'} ${Math.abs(dSai)}% vs ${N===1?'mês':N+' meses'} anterior${N===1?'':'es'}`}</small></div>
      <div class="fin-kpi"><span>Taxa de poupança</span><b class="${poup>=20?'pos':poup<10?'neg':''}">${poup}%</b><small>${brl(apo)} guardados de ${brl(rec)} recebidos</small></div>
      <div class="fin-kpi"><span>Custo fixo / receita</span><b class="${fixoPct>50?'neg':''}">${fixoPct}%</b><small>${brl(fixos)} em contas fixas${fixoPct>50?' · acima de 50% deixa pouca margem':''}</small></div>
      <div class="fin-kpi"><span>Parcelas futuras no cartão</span><b>${brl(futTot)}</b><small>${futTot?`até ${ymLabel(futUlt)}${recMedia?` · ${Math.round(futTot/recMedia*100)}% de uma receita média`:''}`:'nenhuma compra parcelada à frente'}</small></div>
      ${ritmo}
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>Evolução mensal</h3><div class="h-sub">receitas × saídas × aportes, com a sobra de cada competência</div>
      ${finChartEvo(evo)}
    </div>

    <div class="row">
      <div class="card" style="flex:1;min-width:300px">
        <h3>Para onde foi o dinheiro</h3><div class="h-sub">${ymLabel(meses[0])}${N>1?' → '+ymLabel(fim):''} · variação vs período anterior</div>
        ${finChartDonut(catList,sai)}
        <div class="fin-leg">${catList.map(([k,v])=>{const c=finCatInfo(k), a=catsA[k]||0, d=a>0?Math.round((v-a)/a*100):null;
          return `<div class="fin-leg-r"><i style="background:${c.cor}"></i><span>${c.nome}</span><small>${Math.round(v/sai*100)}%</small>
            <em class="${d==null?'':d>10?'neg':d<-10?'pos':''}">${d==null?'novo':(d>0?'▲':'▼')+Math.abs(d)+'%'}</em><b>${brl(v)}</b></div>`;}).join('')}</div>
      </div>
      <div class="card" style="flex:1;min-width:300px">
        <h3>Categoria × mês</h3><div class="h-sub">quanto mais forte a cor, maior o gasto naquele mês</div>
        ${finChartHeat(evo.slice(-6),catList.slice(0,9).map(x=>x[0]))}
        <h3 style="margin-top:22px">Como saiu</h3><div class="h-sub">forma de pagamento no período</div>
        ${finChartMeios(R,sai)}
      </div>
    </div>

    <div class="row" style="margin-top:18px">
      <div class="card" style="flex:1;min-width:300px">
        <h3>Maiores destinos</h3><div class="h-sub">agrupado por descrição · onde cortar faz diferença</div>
        ${finChartTop(R,sai)}
      </div>
      <div class="card" style="flex:1;min-width:300px">
        <h3>Cartão comprometido à frente</h3><div class="h-sub">parcelas já contratadas por fatura (todos os cartões)</div>
        ${finChartFuturo(ps)}
      </div>
    </div>`;
}
export function finAnNav(meses){
  return `<div class="fin-nav" style="flex-wrap:wrap">
    <button class="icon-btn" onclick="finAnFim(-1)">◀</button>
    <div><b>${FIN_AN.per===1?ymLabel(meses[0],true):ymLabel(meses[0])+' → '+ymLabel(meses[meses.length-1])}</b><small>por competência · mesma base da aba Mês</small></div>
    <button class="icon-btn" onclick="finAnFim(1)">▶</button>
    <div class="cal-switch" style="margin-left:auto">${[[1,'1 mês'],[3,'3m'],[6,'6m'],[12,'12m']].map(([n,l])=>`<button class="${FIN_AN.per===n?'on':''}" onclick="finAnPer(${n})">${l}</button>`).join('')}</div>
  </div>`;
}
export function finChartEvo(evo){
  if(!evo.length) return '<div class="empty">Sem histórico.</div>';
  const W=Math.max(560,evo.length*78), H=210, pl=46, pb=34, pt=14, iw=W-pl-12, ih=H-pb-pt;
  const max=Math.max(1,...evo.map(r=>Math.max(r.rec,r.saidas+r.apo)));
  const min=Math.min(0,...evo.map(r=>r.sobra));
  const y=v=>pt+ih-(v-min)/(max-min)*ih, gw=iw/evo.length, bw=Math.min(22,gw/3.2);
  const ticks=[0,.25,.5,.75,1].map(t=>min+(max-min)*t);
  let g=ticks.map(t=>`<line x1="${pl}" x2="${W-12}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl-6}" y="${y(t)+4}" text-anchor="end" font-size="10" fill="var(--faint)">${finK(t)}</text>`).join('');
  const pts=[];
  evo.forEach((r,i)=>{
    const cx=pl+gw*i+gw/2;
    g+=`<rect x="${cx-bw-1}" y="${y(r.rec)}" width="${bw}" height="${y(0)-y(r.rec)}" rx="3" fill="var(--green)" opacity=".85"><title>Receitas ${brl(r.rec)}</title></rect>`;
    g+=`<rect x="${cx+1}" y="${y(r.saidas)}" width="${bw}" height="${y(0)-y(r.saidas)}" rx="3" fill="var(--rose)" opacity=".85"><title>Saídas ${brl(r.saidas)}</title></rect>`;
    if(r.apo) g+=`<rect x="${cx+1}" y="${y(r.saidas+r.apo)}" width="${bw}" height="${y(r.saidas)-y(r.saidas+r.apo)}" rx="3" fill="var(--blue)" opacity=".85"><title>Aportes ${brl(r.apo)}</title></rect>`;
    g+=`<text x="${cx}" y="${H-14}" text-anchor="middle" font-size="11" fill="var(--muted)">${FIN_MESES[+r.M.slice(5)-1]}</text>`;
    pts.push([cx,y(r.sobra),r.sobra]);
  });
  g+=`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--purple)" stroke-width="2.2"/>`;
  g+=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--card)" stroke="var(--purple)" stroke-width="2"><title>Sobra ${brl(p[2])}</title></circle><text x="${p[0]}" y="${p[1]-8}" text-anchor="middle" font-size="10" font-weight="600" fill="${p[2]<0?'var(--red)':'var(--purple)'}">${finK(p[2])}</text>`).join('');
  return `<div class="chart-wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block" xmlns="http://www.w3.org/2000/svg">${g}</svg></div>
    <div class="chart-legend" style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:6px">
      <span><i style="background:var(--green)"></i>Receitas</span><span><i style="background:var(--rose)"></i>Saídas</span>
      <span><i style="background:var(--blue)"></i>Aportes</span><span><i style="background:var(--purple);height:3px"></i>Sobra</span></div>`;
}
export function finChartDonut(list,tot){
  if(!tot) return '';
  const R=70,r=44,cx=90,cy=90; let a0=-Math.PI/2, g='';
  const arc=(a,b,col,tt)=>{ if(b-a>=2*Math.PI-1e-6) return `<circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="${col}" stroke-width="${R-r}"><title>${tt}</title></circle>`;
    const p=(ang,rad)=>[cx+rad*Math.cos(ang),cy+rad*Math.sin(ang)], L=b-a>Math.PI?1:0;
    const [x1,y1]=p(a,R),[x2,y2]=p(b,R),[x3,y3]=p(b,r),[x4,y4]=p(a,r);
    return `<path d="M${x1},${y1} A${R},${R} 0 ${L} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${L} 0 ${x4},${y4} Z" fill="${col}"><title>${tt}</title></path>`; };
  list.forEach(([k,v])=>{const a1=a0+v/tot*2*Math.PI, c=finCatInfo(k); g+=arc(a0,a1,c.cor,`${c.nome}: ${brl(v)}`); a0=a1;});
  return `<div style="display:flex;justify-content:center;margin:6px 0 10px"><svg width="180" height="180" viewBox="0 0 180 180">${g}
    <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--faint)">saídas</text>
    <text x="90" y="104" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${finK(tot)}</text></svg></div>`;
}
export function finChartHeat(evo,catIds){
  if(!evo.length||!catIds.length) return '<div class="empty">Sem dados.</div>';
  const val=(r,k)=>r2(r.sai.filter(x=>x.cat===k).reduce((s,x)=>s+x.valor,0));
  return `<div class="table-wrap"><table class="fin-heat"><thead><tr><th></th>${evo.map(r=>`<th>${FIN_MESES[+r.M.slice(5)-1]}</th>`).join('')}</tr></thead><tbody>
    ${catIds.map(k=>{const c=finCatInfo(k), vs=evo.map(r=>val(r,k)), mx=Math.max(1,...vs);
      return `<tr><td class="fin-heat-l"><i style="background:${c.cor}"></i>${c.nome}</td>${vs.map(v=>`<td style="background:${v?finHexA(c.cor,.12+.78*v/mx):'transparent'};color:${v/mx>.55?'#fff':'var(--ink)'}" title="${c.nome}: ${brl(v)}">${v?finK(v):'·'}</td>`).join('')}</tr>`;}).join('')}
  </tbody></table></div>`;
}
export function finChartMeios(R,tot){
  const m={}; R.forEach(r=>r.sai.forEach(x=>{m[x.meio]=(m[x.meio]||0)+x.valor;}));
  const nomes={conta:'Contas (boleto/débito aut.)',credito:'Cartão de crédito',pix:'Pix',debito:'Débito',dinheiro:'Dinheiro'};
  const cores={conta:'var(--muted)',credito:'var(--purple)',pix:'var(--green)',debito:'var(--blue)',dinheiro:'var(--amber)'};
  const l=Object.entries(m).sort((a,b)=>b[1]-a[1]);
  return l.map(([k,v])=>`<div class="bar-row"><div class="lbl">${nomes[k]||k}</div>
    <div class="bar-track"><i style="width:${Math.round(v/tot*100)}%;background:${cores[k]||'var(--faint)'}"></i></div>
    <div class="val">${Math.round(v/tot*100)}% · ${finK(v)}</div></div>`).join('');
}
export function finChartTop(R,tot){
  const m={}; R.forEach(r=>r.sai.forEach(x=>{const k=finNorm(x.desc).replace(/[^a-z0-9]+/g,' ').trim();
    if(!m[k]) m[k]={desc:x.desc,v:0,n:0,cat:x.cat}; m[k].v+=x.valor; m[k].n++;}));
  const l=Object.values(m).sort((a,b)=>b.v-a.v).slice(0,10), mx=l.length?l[0].v:1;
  return l.map(x=>{const c=finCatInfo(x.cat); return `<div class="bar-row"><div class="lbl" title="${h(x.desc)}">${h(x.desc)}</div>
    <div class="bar-track"><i style="width:${Math.round(x.v/mx*100)}%;background:${c.cor}"></i></div>
    <div class="val">${finK(r2(x.v))}${x.n>1?` <small>(${x.n}×)</small>`:''}</div></div>`;}).join('')
    +`<div class="h-sub" style="margin-top:8px">Top 10 = ${Math.round(l.reduce((s,x)=>s+x.v,0)/tot*100)}% das saídas do período</div>`;
}
export function finChartFuturo(ps){
  const ini=todayISO().slice(0,7), ms=Array.from({length:12},(_,i)=>ymAdd(ini,i));
  const v=ms.map(ym=>r2(ps.filter(p=>p.fat===ym&&p.n>1).reduce((s,p)=>s+p.valor,0)));
  if(!v.some(Boolean)) return '<div class="empty">Nenhuma compra parcelada à frente. Importe a fatura para ver as parcelas em andamento.</div>';
  const mx=Math.max(...v);
  return `<div class="fin-proj" style="margin-top:4px">${ms.map((ym,i)=>`<div><i style="height:${Math.max(3,Math.round(v[i]/mx*90))}px"></i><b>${v[i]?finK(v[i]):'—'}</b><span>${FIN_MESES[+ym.slice(5)-1]}</span></div>`).join('')}</div>
    <div class="h-sub" style="margin-top:8px">Só parcelas de compras parceladas — compras à vista no crédito ainda não feitas não aparecem aqui.</div>`;
}
