// financas/dashboard.js — gerado a partir do monólito; edite aqui a partir de agora.
import { todayISO } from '../core/datas.js';
import { h } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';
import { addDaysISO } from '../views/analytics/graficos.js';
import { fin, finSave, finTemDados } from './core.js';
import { brl, ddmm, finCompDe, finFaturasDaComp, finTodasParcelas, r2, ymAdd } from './util.js';

/* ======================================================================
   DASHBOARD: contas a vencer
   ====================================================================== */
export function finAVencer(dias){
  const hoje=todayISO(), lim=addDaysISO(hoje,dias);
  const itens=fin.contas.filter(c=>c.tipo==='despesa'&&!c.ok&&c.venc&&c.venc<=lim)
    .map(c=>({id:c.id,desc:c.desc,valor:c.valor,venc:c.venc,virtual:false}));
  const ps=finTodasParcelas(), vistos=new Set(), base=finCompDe(hoje);
  [-2,-1,0,1].forEach(k=>finFaturasDaComp(ymAdd(base,k),ps).forEach(f=>{
    if(vistos.has(f.id)||f.ok||!f.valor||f.venc>lim) return; vistos.add(f.id);
    itens.push({id:f.id,desc:'💳 '+f.desc,valor:f.valor,venc:f.venc,virtual:true,cid:f.cartao.id,ym:f.ym}); }));
  return itens.sort((a,b)=>a.venc.localeCompare(b.venc)||b.valor-a.valor);
}
export function finDashCard(){
  if(!finTemDados()) return '';
  const hoje=todayISO(), itens=finAVencer(7); if(!itens.length) return '';
  const oc=!!fin.cfg.ocultarDash, v=x=>oc?'R$ •••':brl(x);
  const atras=itens.filter(i=>i.venc<hoje), tot=r2(itens.reduce((s,i)=>s+i.valor,0));
  const rot=i=>{const d=Math.round((new Date(i.venc+'T12:00')-new Date(hoje+'T12:00'))/864e5);
    return d<0?`<span class="pill red">⚠ venceu ${ddmm(i.venc)}</span>`:d===0?'<span class="pill red">vence hoje</span>'
      :d===1?'<span class="pill amber">amanhã</span>':`<span class="pill gray">${ddmm(i.venc)} · em ${d} dias</span>`;};
  return `<div class="card" style="margin-bottom:20px">
    <div class="fin-card-h"><div><h3>💸 Contas a vencer</h3>
      <div class="h-sub">próximos 7 dias${atras.length?` · <b style="color:var(--red)">${atras.length} vencida${atras.length>1?'s':''}</b>`:''} · total ${v(tot)}</div></div>
      <div style="display:flex;gap:6px"><button class="icon-btn" onclick="finOcultarDash()" title="${oc?'Mostrar':'Ocultar'} valores">${oc?'🙈':'👁'}</button>
      <button class="btn sm line" onclick="FIN_ST.aba='mes';FIN_ST.comp=null;go('financas')">Abrir finanças</button></div></div>
    ${itens.slice(0,8).map(i=>`<div class="list-item">
      <div class="check-sq" title="Marcar como pago" onclick="${i.virtual?`finToggleFat('${i.cid}','${i.ym}')`:`finToggleConta('${i.id}')`}">✓</div>
      <div class="li-body"><div class="t">${h(i.desc)}</div><div class="m">${rot(i)}</div></div>
      <b class="fin-val">${v(i.valor)}</b></div>`).join('')}
    ${itens.length>8?`<div class="h-sub" style="margin-top:8px">+ ${itens.length-8} outras em Finanças</div>`:''}
  </div>`;
}
export function finOcultarDash(){fin.cfg.ocultarDash=!fin.cfg.ocultarDash; finSave(); renderCurrent();}
