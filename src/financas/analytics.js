// financas/analytics.js — gerado a partir do monólito; edite aqui a partir de agora.
import { todayISO } from '../core/datas.js';
import { h } from '../ui/base.js';
import { fin, finCat, finCatById } from './core.js';
import { FIN_MESES, brl, finCiclo, finCompDe, finFatKey, finFaturasDaComp, finNorm, finTodasParcelas, r2, ymAdd, ymDia, ymLabel } from './util.js';
import { finCategorizar } from './voz.js';
import { FIN_ST, finEfComp, vFinancas } from './view.js';

/* ======================================================================
   ANALYTICS FINANCEIRO
   Base = a mesma do Mês: o que saiu do dinheiro de cada competência
   (contas + parcelas de cartão pela categoria de cada compra + à vista do ciclo).
   Por isso os gráficos somam exatamente o total que a aba Mês mostra.
   Categorias marcadas como PATRIMÔNIO (terreno, imóvel…) saem das saídas: o dinheiro
   virou ativo. Entram na taxa de poupança junto com os aportes.
   ====================================================================== */
export const FIN_CAT_CARTAO={id:'_cartao',nome:'Cartão (não detalhado)',cor:'#b9b3c6'};
export const finCatInfo=id=>id==='_cartao'?FIN_CAT_CARTAO:finCat(id);
export const finEhPatrimonio=cat=>Array.isArray(fin.cfg.catsPatrimonio)&&fin.cfg.catsPatrimonio.includes(cat);
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
  const tudo=finSaidasComp(M,ps), soma=a=>r2(a.reduce((s,x)=>s+x.valor,0));
  const sai=tudo.filter(x=>!finEhPatrimonio(x.cat)), patrim=soma(tudo.filter(x=>finEhPatrimonio(x.cat)));
  const rec=soma(fin.contas.filter(c=>c.tipo==='receita'&&c.comp===M));
  const apo=soma(fin.contas.filter(c=>c.tipo==='aporte'&&finEfComp(c)===M));
  const saidas=soma(sai);
  return {M,sai,rec,apo,patrim,saidas,sobra:r2(rec-saidas-apo-patrim),fixos:soma(sai.filter(x=>x.fixo))};
}

/* ---- Início do histórico ----
   Comparar com um período em que uma fonte ainda não era lançada mede "comecei a registrar",
   não "gastei mais": as contas só existem a partir de set/2026, então Casa ia de R$ 162 a
   R$ 3,7 mil e aparecia ▲4.686%. O histórico só está completo a partir do mês em que TODAS as
   fontes que você usa já existiam — o mais tardio dos inícios. Fonte que nunca usou não conta. */
export function finHistIni(ps){
  ps=ps||finTodasParcelas();
  const ini=[];
  const contas=fin.contas.filter(c=>c.tipo==='despesa').map(c=>finEfComp(c)).sort()[0]; if(contas) ini.push(contas);
  const cart=ps.map(p=>{ const c=fin.cartoes.find(x=>x.id===p.cartao); return c?finCompDe(ymDia(p.fat,c.vence)):''; }).filter(Boolean).sort()[0];
  if(cart) ini.push(cart);
  const av=fin.gastos.filter(g=>g.meio!=='credito'&&g.data).map(g=>g.data).sort()[0]; if(av) ini.push(finCompDe(av));
  return ini.sort().pop()||'';
}

export const FIN_AN={per:3,fim:null,modo:'tudo'};
export function finAnPer(n){FIN_AN.per=n;vFinancas();}
export function finAnFim(n){FIN_AN.fim=n===0?finCompDe(todayISO()):ymAdd(FIN_AN.fim,n);vFinancas();}
export function finAnModo(m){FIN_AN.modo=m;vFinancas();}
export function finHexA(hex,a){const m=hex.replace('#','').match(/.{2}/g); if(!m) return hex; const [r,g,b]=m.map(x=>parseInt(x,16)); return `rgba(${r},${g},${b},${a})`;}
export const finK=v=>{const a=Math.abs(v); return (v<0?'-':'')+(a>=1e6?(a/1e6).toFixed(1).replace('.',',')+'M':a>=1e3?(a/1e3).toFixed(a>=1e4?0:1).replace('.',',')+'k':Math.round(a));};

export function finVAnalytics(){
  if(!FIN_AN.fim) FIN_AN.fim=FIN_ST.comp||finCompDe(todayISO());
  const fim=FIN_AN.fim, N=FIN_AN.per, ps=finTodasParcelas();
  const meses=Array.from({length:N},(_,i)=>ymAdd(fim,i-N+1));
  const ant=Array.from({length:N},(_,i)=>ymAdd(fim,i-2*N+1));
  const R=meses.map(m=>finResumoComp(m,ps)), RA=ant.map(m=>finResumoComp(m,ps));
  const serie=Array.from({length:12},(_,i)=>finResumoComp(ymAdd(fim,i-11),ps));
  const primeiro=serie.findIndex(r=>r.rec||r.saidas||r.apo||r.patrim); const evo=primeiro<0?[]:serie.slice(primeiro);
  const tot=(arr,k)=>r2(arr.reduce((s,r)=>s+r[k],0));
  const rec=tot(R,'rec'), sai=tot(R,'saidas'), apo=tot(R,'apo'), patrim=tot(R,'patrim'), fixos=tot(R,'fixos'), saiAnt=tot(RA,'saidas');
  if(!rec&&!sai&&!apo&&!patrim) return finAnNav(meses)+`<div class="card"><div class="empty">Sem dados neste período.<br>Importe a planilha ou registre gastos para ver os gráficos.</div></div>`;
  // histórico: comparação só vale se o período anterior inteiro já tinha todas as fontes
  const hIni=finHistIni(ps), antOk=!!hIni&&ant[0]>=hIni, atualIncompleto=!!hIni&&meses[0]<hIni;
  const semHist=`sem histórico completo antes de ${hIni?ymLabel(hIni):'—'}`;
  // modo "só variável": tira contas fixas (geradas por um fixo) dos gráficos de categoria
  const variavel=FIN_AN.modo==='variavel';
  const filtra=rs=>variavel?rs.map(r=>({...r,sai:r.sai.filter(x=>!x.fixo)})):rs;
  const Rc=filtra(R), RAc=filtra(RA), evoC=filtra(evo);
  const saiC=r2(Rc.reduce((s,r)=>s+r.sai.reduce((t,x)=>t+x.valor,0),0));
  const agr=rs=>{const m={}; rs.forEach(r=>r.sai.forEach(x=>{m[x.cat]=(m[x.cat]||0)+x.valor;})); return m;};
  const cats=agr(Rc), catsA=agr(RAc);
  const catList=Object.entries(cats).map(([k,v])=>[k,r2(v)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  // KPIs (sempre sobre o total)
  const guardado=r2(apo+patrim);
  const poup=rec>0?Math.round(guardado/rec*100):0, fixoPct=rec>0?Math.round(fixos/rec*100):0;
  const dSai=antOk&&saiAnt>0?Math.round((sai-saiAnt)/saiAnt*100):null;
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
  const nomesPat=(fin.cfg.catsPatrimonio||[]).map(id=>finCatById(id)).filter(Boolean).map(c=>c.nome);
  return finAnNav(meses)+`
    ${atualIncompleto?`<div class="fin-flag" style="margin-bottom:14px">⚠ ${ymLabel(meses[0])}${meses.filter(m=>m<hIni).length>1?' a '+ymLabel(meses.filter(m=>m<hIni).pop()):''} ainda não tinha${meses.filter(m=>m<hIni).length>1?'m':''} todas as fontes lançadas (o histórico completo começa em ${ymLabel(hIni)}) — os totais deste período estão subestimados.</div>`:''}
    <div class="fin-kpis">
      <div class="fin-kpi"><span>Saídas no período</span><b>${brl(sai)}</b><small>${dSai==null?(antOk?'sem período anterior para comparar':semHist):`${dSai>0?'▲':'▼'} ${Math.abs(dSai)}% vs ${N===1?'mês':N+' meses'} anterior${N===1?'':'es'}`}${patrim?` · sem ${brl(patrim)} de patrimônio`:''}</small></div>
      <div class="fin-kpi"><span>Taxa de poupança</span><b class="${poup>=20?'pos':poup<10?'neg':''}">${poup}%</b><small>${brl(apo)} guardados${patrim?` + ${brl(patrim)} em patrimônio`:''} de ${brl(rec)} recebidos</small></div>
      <div class="fin-kpi"><span>Custo fixo / receita</span><b class="${fixoPct>50?'neg':''}">${fixoPct}%</b><small>${brl(fixos)} em contas fixas${patrim?' (sem patrimônio)':''}${fixoPct>50?' · acima de 50% deixa pouca margem':''}</small></div>
      <div class="fin-kpi"><span>Parcelas futuras no cartão</span><b>${brl(futTot)}</b><small>${futTot?`até ${ymLabel(futUlt)}${recMedia?` · ${Math.round(futTot/recMedia*100)}% de uma receita média`:''}`:'nenhuma compra parcelada à frente'}</small></div>
      ${ritmo}
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>Evolução mensal</h3><div class="h-sub">receitas × saídas × aportes${nomesPat.length?' e patrimônio':''}, com a sobra de cada competência</div>
      ${finChartEvo(evo)}
    </div>

    <div class="row">
      <div class="card" style="flex:1;min-width:300px">
        <div class="fin-card-h"><div><h3>Para onde foi o dinheiro</h3>
          <div class="h-sub">${ymLabel(meses[0])}${N>1?' → '+ymLabel(fim):''} · ${antOk?'variação vs período anterior':semHist}${variavel?' · <b>só gasto variável</b> (sem contas fixas)':''}${nomesPat.length?` · sem ${h(nomesPat.join(', '))} (conta como patrimônio, não como gasto)`:''}</div></div>
          <div class="cal-switch">${[['tudo','Tudo'],['variavel','Só variável']].map(([k,l])=>`<button class="${FIN_AN.modo===k?'on':''}" onclick="finAnModo('${k}')">${l}</button>`).join('')}</div></div>
        ${finChartDonut(catList,saiC)}
        <div class="fin-leg">${catList.map(([k,v])=>{const c=finCatInfo(k), a=catsA[k]||0, d=antOk&&a>0?Math.round((v-a)/a*100):null;
          return `<div class="fin-leg-r"><i style="background:${c.cor}"></i><span>${c.nome}</span><small>${Math.round(v/saiC*100)}%</small>
            <em class="${d==null?'':d>10?'neg':d<-10?'pos':''}" ${antOk?'':`title="${h(semHist)}"`}>${!antOk?'—':d==null?'novo':(d>0?'▲':'▼')+Math.abs(d)+'%'}</em><b>${brl(v)}</b></div>`;}).join('')}</div>
      </div>
      <div class="card" style="flex:1;min-width:300px">
        <h3>Categoria × mês</h3><div class="h-sub">quanto mais forte a cor, maior o gasto naquele mês${variavel?' · só variável':''}</div>
        ${finChartHeat(evoC.slice(-6),catList.slice(0,9).map(x=>x[0]),hIni)}
        <h3 style="margin-top:22px">Como saiu</h3><div class="h-sub">forma de pagamento no período${variavel?' · só variável':''}</div>
        ${finChartMeios(Rc,saiC)}
      </div>
    </div>

    <div class="row" style="margin-top:18px">
      <div class="card" style="flex:1;min-width:300px">
        <h3>Maiores destinos</h3><div class="h-sub">agrupado por descrição · ${variavel?'só gasto variável — onde cortar faz diferença':'inclui contas fixas — use “Só variável” para ver onde dá para cortar'}</div>
        ${finChartTop(Rc,saiC)}
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
  const guard=r=>r2(r.apo+(r.patrim||0));
  const max=Math.max(1,...evo.map(r=>Math.max(r.rec,r.saidas+guard(r))));
  const min=Math.min(0,...evo.map(r=>r.sobra));
  const y=v=>pt+ih-(v-min)/(max-min)*ih, gw=iw/evo.length, bw=Math.min(22,gw/3.2);
  const ticks=[0,.25,.5,.75,1].map(t=>min+(max-min)*t);
  let g=ticks.map(t=>`<line x1="${pl}" x2="${W-12}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl-6}" y="${y(t)+4}" text-anchor="end" font-size="10" fill="var(--faint)">${finK(t)}</text>`).join('');
  const pts=[];
  evo.forEach((r,i)=>{
    const cx=pl+gw*i+gw/2, gu=guard(r);
    g+=`<rect x="${cx-bw-1}" y="${y(r.rec)}" width="${bw}" height="${y(0)-y(r.rec)}" rx="3" fill="var(--green)" opacity=".85"><title>Receitas ${brl(r.rec)}</title></rect>`;
    g+=`<rect x="${cx+1}" y="${y(r.saidas)}" width="${bw}" height="${y(0)-y(r.saidas)}" rx="3" fill="var(--rose)" opacity=".85"><title>Saídas ${brl(r.saidas)}</title></rect>`;
    if(gu) g+=`<rect x="${cx+1}" y="${y(r.saidas+gu)}" width="${bw}" height="${y(r.saidas)-y(r.saidas+gu)}" rx="3" fill="var(--blue)" opacity=".85"><title>Aportes ${brl(r.apo)}${r.patrim?' + patrimônio '+brl(r.patrim):''}</title></rect>`;
    g+=`<text x="${cx}" y="${H-14}" text-anchor="middle" font-size="11" fill="var(--muted)">${FIN_MESES[+r.M.slice(5)-1]}</text>`;
    pts.push([cx,y(r.sobra),r.sobra]);
  });
  g+=`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--purple)" stroke-width="2.2"/>`;
  g+=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--card)" stroke="var(--purple)" stroke-width="2"><title>Sobra ${brl(p[2])}</title></circle><text x="${p[0]}" y="${p[1]-8}" text-anchor="middle" font-size="10" font-weight="600" fill="${p[2]<0?'var(--red)':'var(--purple)'}">${finK(p[2])}</text>`).join('');
  return `<div class="chart-wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block" xmlns="http://www.w3.org/2000/svg">${g}</svg></div>
    <div class="chart-legend" style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:6px">
      <span><i style="background:var(--green)"></i>Receitas</span><span><i style="background:var(--rose)"></i>Saídas</span>
      <span><i style="background:var(--blue)"></i>Aportes${evo.some(r=>r.patrim)?' + patrimônio':''}</span><span><i style="background:var(--purple);height:3px"></i>Sobra</span></div>`;
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
export function finChartHeat(evo,catIds,hIni){
  if(!evo.length||!catIds.length) return '<div class="empty">Sem dados.</div>';
  const val=(r,k)=>r2(r.sai.filter(x=>x.cat===k).reduce((s,x)=>s+x.valor,0));
  const inc=r=>hIni&&r.M<hIni;   // mês sem todas as fontes: valor baixo é falta de registro
  return `<div class="table-wrap"><table class="fin-heat"><thead><tr><th></th>${evo.map(r=>`<th ${inc(r)?`title="incompleto: antes de ${ymLabel(hIni)} nem todas as fontes eram lançadas" style="opacity:.55"`:''}>${FIN_MESES[+r.M.slice(5)-1]}${inc(r)?'*':''}</th>`).join('')}</tr></thead><tbody>
    ${catIds.map(k=>{const c=finCatInfo(k), vs=evo.map(r=>val(r,k)), mx=Math.max(1,...vs);
      return `<tr><td class="fin-heat-l"><i style="background:${c.cor}"></i>${c.nome}</td>${vs.map(v=>`<td style="background:${v?finHexA(c.cor,.12+.78*v/mx):'transparent'};color:${v/mx>.55?'#fff':'var(--ink)'}" title="${c.nome}: ${brl(v)}">${v?finK(v):'·'}</td>`).join('')}</tr>`;}).join('')}
  </tbody></table></div>${evo.some(inc)?`<div class="h-sub" style="margin-top:6px">* mês incompleto — antes de ${ymLabel(hIni)} nem todas as fontes eram lançadas</div>`:''}`;
}
export function finChartMeios(R,tot){
  if(!tot) return '<div class="empty">Sem dados.</div>';
  const m={}; R.forEach(r=>r.sai.forEach(x=>{m[x.meio]=(m[x.meio]||0)+x.valor;}));
  const nomes={conta:'Contas (boleto/débito aut.)',credito:'Cartão de crédito',pix:'Pix',debito:'Débito',dinheiro:'Dinheiro'};
  const cores={conta:'var(--muted)',credito:'var(--purple)',pix:'var(--green)',debito:'var(--blue)',dinheiro:'var(--amber)'};
  const l=Object.entries(m).sort((a,b)=>b[1]-a[1]);
  return l.map(([k,v])=>`<div class="bar-row"><div class="lbl">${nomes[k]||k}</div>
    <div class="bar-track"><i style="width:${Math.round(v/tot*100)}%;background:${cores[k]||'var(--faint)'}"></i></div>
    <div class="val">${Math.round(v/tot*100)}% · ${finK(v)}</div></div>`).join('');
}
export function finChartTop(R,tot){
  if(!tot) return '<div class="empty">Sem dados.</div>';
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
