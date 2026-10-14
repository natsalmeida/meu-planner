// financas/orcamento.js — teto mensal por categoria para o gasto VARIÁVEL (aba Gastos).
import { todayISO } from '../core/datas.js';
import { closeModal, h, modal, toast } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';
import { FIN_CATS, fin, finCat, finCatById, finSave } from './core.js';
import { brl, parseBRL, r2, ymAdd, ymDias, ymLabel } from './util.js';
import { finItensGastos } from './view.js';

/* Onde mora: fin.cfg.orcamentos = {catId: valor}.
   Em cfg (nó único) e não num mapa próprio de propósito: uma aba com a versão ANTIGA do app
   aberta em outro aparelho preserva chaves desconhecidas de cfg ao salvar, mas um mapa novo
   (meu_financeiro/orcamentos/{cat}) seria lido por ela como lixo e regravado por cima.
   Custo da escolha: editar o orçamento em dois aparelhos ao mesmo tempo → vence o último
   salvamento, como qualquer outro ajuste de cfg. Para algo que muda raramente, aceitável.

   Base de cálculo: mesma da aba Gastos no modo "Parcela do mês" — data da compra, compra
   parcelada no crédito entra só com a parcela do mês, estorno abate a categoria.
   Contas (aluguel, internet…) ficam de fora: são previsíveis e já têm a aba Mês; incluí-las
   faria "Casa" nascer em 90% todo dia 1º e o alerta perderia o sentido. */
export function finOrc(){
  const o=fin.cfg&&fin.cfg.orcamentos;
  return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
}
export function finOrcGastoMes(ym){
  const m={};
  finItensGastos(ym,'parcela').forEach(it=>{ m[it.g.cat]=r2((m[it.g.cat]||0)+it.valor); });
  return m;
}
/* Média dos últimos n meses fechados (zeros incluídos), ignorando meses anteriores ao
   primeiro gasto registrado no app — senão o começo vazio puxa a média para baixo. */
export function finOrcMedias(ym,n=3){
  const prim=fin.gastos.reduce((m,g)=>!m||g.data<m?g.data:m,'');
  if(!prim) return {};
  const meses=Array.from({length:n},(_,i)=>ymAdd(ym,-(i+1))).filter(m=>m>=prim.slice(0,7));
  if(!meses.length) return {};
  const tot={};
  meses.forEach(m=>{ const g=finOrcGastoMes(m); Object.keys(g).forEach(c=>{ tot[c]=(tot[c]||0)+g[c]; }); });
  Object.keys(tot).forEach(c=>{ tot[c]=r2(tot[c]/meses.length); });
  return tot;
}
/* nivel: 'estourou' > teto · 'atencao' ≥80% com menos de 80% do mês passado ·
   'perto' ≥80% já no fim do mês · 'ok'. Só 'estourou' e 'atencao' vão para o Dashboard. */
export function finOrcStatus(ym){
  const orc=finOrc(), gastos=finOrcGastoMes(ym), hoje=todayISO(), cur=hoje.slice(0,7);
  const frac=ym===cur?(+hoje.slice(8,10))/ymDias(ym):ym<cur?1:0;
  return Object.keys(orc).filter(c=>finCatById(c)&&orc[c]>0).map(cat=>{
    const teto=orc[cat], gasto=Math.max(0,gastos[cat]||0), pct=gasto/teto;
    const nivel=pct>1?'estourou':pct>=0.8&&frac<0.8?'atencao':pct>=0.8?'perto':'ok';
    return {cat,teto,gasto,pct,frac,nivel,resta:r2(teto-gasto),atual:ym===cur};
  }).sort((a,b)=>b.pct-a.pct);
}

const COR={estourou:'var(--red)',atencao:'var(--amber)',perto:'var(--amber)'};
function finOrcLinha(s){
  const c=finCat(s.cat), larg=Math.min(100,Math.round(s.pct*100)), cor=COR[s.nivel]||c.cor;
  const ritmo=s.atual&&s.frac>0&&s.frac<1
    ?`<b style="position:absolute;left:${Math.round(s.frac*100)}%;top:-3px;bottom:-3px;width:2px;border-radius:1px;background:var(--ink);opacity:.35" title="Hoje: ${Math.round(s.frac*100)}% do mês"></b>`:'';
  const sub=s.nivel==='estourou'?`<span style="color:var(--red);font-weight:600">passou ${brl(-s.resta)}</span>`
    :`<span>resta ${brl(s.resta)}</span>`;
  return `<div class="bar-row">
    <div class="lbl" title="${h(c.nome)}">${h(c.nome)}</div>
    <div class="bar-track" style="position:relative"><i style="width:${larg}%;background:${cor}"></i>${ritmo}</div>
    <div class="val">${brl(s.gasto)} <small>/ ${brl(s.teto)}</small><br><small>${Math.round(s.pct*100)}% · ${sub}</small></div>
  </div>`;
}
/* Card da aba Gastos, para o mês selecionado lá. */
export function finOrcCard(ym){
  const st=finOrcStatus(ym);
  if(!st.length) return `<div class="card" style="margin-bottom:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:220px"><h3>🎯 Orçamento do mês</h3>
      <div class="h-sub" style="margin:0">Escolha as categorias que quer acompanhar e um teto mensal para cada uma. Eu aviso no Dashboard quando o ritmo estiver alto.</div></div>
    <button class="btn sm" onclick="finOrcModal()">Definir orçamento</button></div>`;
  const tetos=r2(st.reduce((s,x)=>s+x.teto,0)), gastos=r2(st.reduce((s,x)=>s+x.gasto,0));
  const nEst=st.filter(x=>x.nivel==='estourou').length, atual=st[0].atual;
  return `<div class="card" style="margin-bottom:18px">
    <div class="fin-card-h"><div><h3>🎯 Orçamento · ${ymLabel(ym,true)}</h3>
      <div class="h-sub">${brl(gastos)} de ${brl(tetos)} nas ${st.length} categorias acompanhadas${nEst?` · <b style="color:var(--red)">${nEst} estourada${nEst>1?'s':''}</b>`:''}${atual?' · o traço marca quanto do mês já passou':''}</div></div>
      <button class="btn sm line" onclick="finOrcModal()">Editar</button></div>
    <div class="bars">${st.map(finOrcLinha).join('')}</div>
  </div>`;
}
/* Alertas do Dashboard (mês corrente). `oculto` respeita o 👁 do card de contas. */
export function finOrcDashCard(oculto){
  const al=finOrcStatus(todayISO().slice(0,7)).filter(s=>s.nivel==='estourou'||s.nivel==='atencao');
  if(!al.length) return '';
  const v=x=>oculto?'R$ •••':brl(x);
  return `<div class="card" style="margin-bottom:20px;border:1px solid ${al.some(s=>s.nivel==='estourou')?'var(--red)':'var(--amber)'}">
    <div class="fin-card-h"><div><h3>🎯 Orçamento do mês</h3>
      <div class="h-sub">gasto variável por categoria · contas fixas não entram</div></div>
      <button class="btn sm line" onclick="FIN_ST.aba='gastos';FIN_ST.mesG=null;go('financas')">Ver gastos</button></div>
    ${al.map(s=>`<div class="list-item"><div class="li-body">
      <div class="t">${h(finCat(s.cat).nome)}</div>
      <div class="m">${s.nivel==='estourou'
        ?`<span class="pill red">estourou</span> ${v(s.gasto)} de ${v(s.teto)} · ${Math.round(s.pct*100)}%`
        :`<span class="pill amber">ritmo alto</span> ${Math.round(s.pct*100)}% do teto com ${Math.round(s.frac*100)}% do mês · resta ${v(s.resta)}`}</div>
    </div></div>`).join('')}
  </div>`;
}

/* ---- configuração pelo app: categorias + valores, sem mexer em código ---- */
export function finOrcModal(){
  const orc=finOrc(), med=finOrcMedias(todayISO().slice(0,7));
  const cats=[...FIN_CATS].sort((a,b)=>((orc[b.id]?1:0)-(orc[a.id]?1:0))||((med[b.id]||0)-(med[a.id]||0)));
  const valStr=v=>v?Number(v).toFixed(2).replace('.',','):'';
  modal(`<h3>🎯 Orçamento por categoria</h3>
    <div class="h-sub" style="margin:-8px 0 12px">Preencha só as categorias que quer acompanhar — <b>vazio ou 0 = não acompanha</b>. Vale para o gasto variável (aba Gastos); contas fixas ficam de fora. A média ao lado é dos últimos 3 meses e serve de ponto de partida.</div>
    <div class="fin-orc-lista" style="display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto;padding-right:4px">
      ${cats.map(c=>`<div style="display:flex;align-items:center;gap:10px">
        <span class="tag-dot" style="background:${c.cor}"></span>
        <span style="flex:1;min-width:0;font-size:13px">${h(c.nome)}${med[c.id]>0?`<br><small style="color:var(--faint)">média 3m: ${brl(med[c.id])}
          <button type="button" class="btn sm line" style="padding:1px 7px;font-size:11px;margin-left:4px" onclick="document.getElementById('orc_${c.id}').value='${valStr(Math.ceil(med[c.id]/10)*10)}'">usar</button></small>`:''}</span>
        <input id="orc_${c.id}" data-orc="${c.id}" inputmode="decimal" placeholder="—" value="${valStr(orc[c.id])}" style="width:110px;text-align:right">
      </div>`).join('')}
    </div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finOrcSalvar()">Salvar</button></div>`);
}
export function finOrcSalvar(){
  const novo={};
  document.querySelectorAll('[data-orc]').forEach(el=>{ const v=parseBRL(el.value); if(v>0&&finCatById(el.dataset.orc)) novo[el.dataset.orc]=v; });
  if(Object.keys(novo).length) fin.cfg.orcamentos=novo; else delete fin.cfg.orcamentos;
  finSave(); closeModal(); renderCurrent();
  const n=Object.keys(novo).length;
  toast(n?`Orçamento salvo · ${n} categoria${n>1?'s':''}`:'Orçamento desativado');
}
