// financas/view.js — gerado a partir do monólito; edite aqui a partir de agora.
import { uid } from '../core/app.js';
import { fmtBR, todayISO } from '../core/datas.js';
import { closeModal, h, modal, toast } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';
import { addDaysISO } from '../views/analytics/graficos.js';
import { finCatOptions } from './categorias.js';
import { FIN_CATS, FIN_MEIOS, fin, finCat, finCatById, finSave, finSyncBox } from './core.js';
import { FIN_MESES, brl, ddmm, finCiclo, finCompDe, finFatKey, finFaturaDaCompra, finFaturasDaComp, finFixosPendentes, finNorm, finParcelas, finTodasParcelas, finVal, parseBRL, r2, ymAdd, ymDia, ymLabel } from './util.js';
import { finAprender, finCategorizar, finConfirmar } from './voz.js';
import { finVAnalytics } from './analytics.js';

/* ---------------- VIEW ---------------- */
export const FIN_ST={aba:'mes',comp:null,mesG:null,meio:'all',cat:'all'};
export function finAba(a){FIN_ST.aba=a;vFinancas();}
export function finComp(n){FIN_ST.comp=n===0?finCompDe(todayISO()):ymAdd(FIN_ST.comp,n);vFinancas();}
export function finMesG(n){FIN_ST.mesG=n===0?todayISO().slice(0,7):ymAdd(FIN_ST.mesG,n);vFinancas();}
export function finMeioF(m){FIN_ST.meio=m;vFinancas();}
/* clicar de novo na mesma categoria (barra do gráfico) desliga o filtro */
export function finCatF(c,alternar=false){FIN_ST.cat=alternar&&FIN_ST.cat===c?'all':c;vFinancas();}

export function vFinancas(){
  if(!FIN_ST.comp) FIN_ST.comp=finCompDe(todayISO());
  if(!FIN_ST.mesG) FIN_ST.mesG=todayISO().slice(0,7);
  const abas=[['mes','Mês'],['gastos','Gastos'],['cartoes','Cartões'],['analytics','Analytics']];
  const corpo=FIN_ST.aba==='gastos'?finVGastos():FIN_ST.aba==='cartoes'?finVCartoes():FIN_ST.aba==='analytics'?finVAnalytics():finVMes();
  document.getElementById('view').innerHTML=`
    <div class="page-title">finanças</div>
    <div class="page-sub">Contas e receitas do mês com baixa manual, gastos do dia a dia registrados por voz e cartões com parcelas calculadas automaticamente. Nada daqui entra em horas de estudo.</div>
    ${finSyncBox()}
    <div class="fin-top">
      <div class="cal-switch">${abas.map(([k,n])=>`<button class="${FIN_ST.aba===k?'on':''}" onclick="finAba('${k}')">${n}</button>`).join('')}</div>
      <div class="fin-top-r">
        <button class="btn sm" onclick="finVozAbrir()">🎙 Registrar gasto</button>
        <button class="btn sm line" onclick="finCfg()" title="Configurações">⚙</button>
        <button class="btn sm line" onclick="finExport()" title="Backup das finanças">⭳</button>
        <button class="btn sm line" onclick="document.getElementById('finImp').click()" title="Restaurar backup">⭱</button>
        <input type="file" id="finImp" accept="application/json" style="display:none" onchange="finImport(this)">
      </div>
    </div>
    ${corpo}`;
}

/* ---- aba Mês ----
   Três tipos de lançamento: receita, despesa (conta) e aporte (dinheiro guardado — não é consumo).
   Conta ADIANTADA: pertence à competência futura (c.comp), mas saiu do dinheiro de outro mês
   (c.pagoComp). Nos totais ela pesa no mês que pagou, não no mês a que pertence. */
export const FIN_TIPOS={receita:'receita',despesa:'conta',aporte:'aporte'};
export function finEfComp(c){return c.ok&&c.pagoComp?c.pagoComp:c.comp;}
export function finVMes(){
  const M=FIN_ST.comp, hoje=todayISO(), ps=finTodasParcelas();
  const byVenc=(a,b)=>(a.venc||'9999').localeCompare(b.venc||'9999')||a.desc.localeCompare(b.desc);
  const soma=(a,f)=>r2(a.filter(f||(()=>true)).reduce((s,x)=>s+x.valor,0));
  const doMes=fin.contas.filter(c=>c.comp===M);
  const rec=doMes.filter(c=>c.tipo==='receita').sort(byVenc);
  const desp=[...doMes.filter(c=>c.tipo==='despesa'),...finFaturasDaComp(M,ps)].sort(byVenc);
  const apo=doMes.filter(c=>c.tipo==='aporte').sort(byVenc);
  // o que ESTE mês pagou por outros meses
  const adiant=fin.contas.filter(c=>c.tipo!=='receita'&&c.ok&&c.pagoComp===M&&c.comp!==M).sort((a,b)=>a.comp.localeCompare(b.comp)||byVenc(a,b));
  const conta=c=>c.virtual||finEfComp(c)===M;          // entra no total deste mês?
  const despT=[...desp.filter(conta),...adiant.filter(c=>c.tipo==='despesa')];
  const apoT=[...apo.filter(conta),...adiant.filter(c=>c.tipo==='aporte')];
  const recPrev=soma(rec), recOk=soma(rec,x=>x.ok), dPrev=soma(despT), dOk=soma(despT,x=>x.ok);
  const aPrev=soma(apoT), aOk=soma(apoT,x=>x.ok);
  const ciclo=finCiclo(M);
  const avista=soma(fin.gastos.filter(g=>g.meio!=='credito'&&g.data>=ciclo.ini&&g.data<=ciclo.fim));
  const livre=r2(recPrev-dPrev-aPrev-avista), realizado=r2(recOk-dOk-aOk-avista);
  const lim=addDaysISO(hoje,5);
  const abertas=desp.filter(d=>!d.ok&&d.venc);
  const atras=abertas.filter(d=>d.venc<hoje), proximas=abertas.filter(d=>d.venc>=hoje&&d.venc<=lim);
  const recAtras=rec.filter(r=>!r.ok&&r.venc&&r.venc<hoje);
  const pend=finFixosPendentes(M);
  const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
  // acumulado por destino (todos os meses, só o que foi efetivamente guardado)
  const acum={}; fin.contas.filter(c=>c.tipo==='aporte'&&c.ok).forEach(c=>{const k=c.desc.trim(); acum[k]=r2((acum[k]||0)+c.valor);});
  const acumTot=r2(Object.values(acum).reduce((s,v)=>s+v,0));
  return `
    <div class="fin-nav">
      <button class="icon-btn" onclick="finComp(-1)">◀</button>
      <div><b>${ymLabel(M,true)}</b><small>competência · tudo que o dinheiro deste mês paga, vença quando vencer</small></div>
      <button class="icon-btn" onclick="finComp(1)">▶</button>
      ${M!==finCompDe(hoje)?`<button class="btn sm line" onclick="finComp(0)">Atual</button>`:''}
    </div>
    <div class="stat-row fin-stats4" style="margin-bottom:18px">
      <div class="stat"><b>${brl(recOk)}</b><span>recebido de ${brl(recPrev)}</span></div>
      <div class="stat"><b>${brl(dOk)}</b><span>pago de ${brl(dPrev)}</span></div>
      <div class="stat"><b>${brl(aOk)}</b><span>guardado de ${brl(aPrev)}</span></div>
      <div class="stat"><b style="${livre<0?'color:#ffd1d1':''}">${brl(livre)}</b><span>livre no ciclo · real ${brl(realizado)}</span></div>
    </div>
    ${pend.length?`<div class="fin-banner">
      <span><b>${pend.length} fixo${pend.length>1?'s':''}</b> ainda não gerado${pend.length>1?'s':''} para ${ymLabel(M)}: ${pend.slice(0,4).map(m=>h(m.desc)).join(', ')}${pend.length>4?'…':''}</span>
      <button class="btn sm" onclick="finGerarMes('${M}')">Gerar</button></div>`:''}
    ${atras.length||recAtras.length?`<div class="alert-late fin-alert">⚠ ${atras.length?`${atras.length} conta${atras.length>1?'s':''} vencida${atras.length>1?'s':''} sem baixa (${brl(soma(atras))})`:''}${atras.length&&recAtras.length?' · ':''}${recAtras.length?`${recAtras.length} receita${recAtras.length>1?'s':''} atrasada${recAtras.length>1?'s':''}`:''}</div>`:''}
    ${proximas.length?`<div class="fin-soon">Próximos 5 dias: ${proximas.map(d=>`<span class="pill amber">${ddmm(d.venc)} · ${h(d.desc)} · ${brl(d.valor)}</span>`).join(' ')}</div>`:''}
    <div class="row">
      <div class="card" style="flex:1;min-width:280px">
        <div class="fin-card-h"><div><h3>Receitas</h3><div class="h-sub">${pct(recOk,recPrev)}% recebido</div></div>
          <button class="btn sm ghost" onclick="finConta(null,'receita')">+ Receita</button></div>
        ${rec.length?rec.map(c=>finRowConta(c,M)).join(''):`<div class="empty">Nenhuma receita em ${ymLabel(M)}.</div>`}
      </div>
      <div class="card" style="flex:1.3;min-width:300px">
        <div class="fin-card-h"><div><h3>Contas</h3><div class="h-sub">${pct(dOk,dPrev)}% pago · faturas entram sozinhas</div></div>
          <div style="display:flex;gap:6px"><button class="btn sm line" onclick="finAdiantar()" title="Pagar agora uma conta de mês futuro">⏩ Adiantar</button>
          <button class="btn sm ghost" onclick="finConta(null,'despesa')">+ Conta</button></div></div>
        ${desp.length?desp.map(c=>finRowConta(c,M)).join(''):`<div class="empty">Nenhuma conta em ${ymLabel(M)}.</div>`}
        ${adiant.length?`<div class="fin-sub-h">Adiantadas com o dinheiro de ${ymLabel(M)} <b>${brl(soma(adiant))}</b></div>
          ${adiant.map(c=>finRowConta(c,M)).join('')}`:''}
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="fin-card-h"><div><h3>Reserva e aportes</h3>
        <div class="h-sub">${pct(aOk,aPrev)}% guardado · acumulado em todos os meses: <b>${brl(acumTot)}</b></div></div>
        <button class="btn sm ghost" onclick="finConta(null,'aporte')">+ Aporte</button></div>
      ${Object.keys(acum).length?`<div class="fin-acum">${Object.entries(acum).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="chip">${h(k)} <b>${brl(v)}</b></span>`).join('')}</div>`:''}
      ${apo.length?apo.map(c=>finRowConta(c,M)).join(''):`<div class="empty" style="padding:18px">Nenhum aporte planejado em ${ymLabel(M)}. Sobra que não tem destino costuma virar gasto.</div>`}
    </div>
    <div class="card" style="margin-top:18px">
      <div class="fin-card-h"><div><h3>Fechamento do ciclo</h3>
        <div class="h-sub">à vista de ${fmtBR(ciclo.ini)} a ${fmtBR(ciclo.fim)} · da 1ª receita deste mês até a véspera da próxima · crédito fica fora (já está na fatura)</div></div>
        <div style="display:flex;gap:6px"><button class="btn sm line" onclick="finColar()">⇪ Colar da planilha</button><button class="btn sm line" onclick="finFixos()">Gerenciar fixos</button></div></div>
      <div class="fin-eq">
        <span>Receitas <b>${brl(recPrev)}</b></span><i>−</i><span>Contas + faturas <b>${brl(dPrev)}</b></span><i>−</i>
        <span>Aportes <b>${brl(aPrev)}</b></span><i>−</i>
        <span>À vista no ciclo <b>${brl(avista)}</b></span><i>=</i><span class="${livre<0?'neg':'pos'}">Livre <b>${brl(livre)}</b></span>
      </div>
    </div>`;
}
export function finRowConta(c,M){
  const hoje=todayISO(), late=!c.ok&&!!c.venc&&c.venc<hoje;
  if(c.virtual){
    return `<div class="list-item ${c.ok?'done':''}">
      <div class="check-sq ${c.ok?'on':''}" onclick="finToggleFat('${c.cartao.id}','${c.ym}')">✓</div>
      <div class="li-body" style="cursor:pointer" onclick="finAba('cartoes')"><div class="t">💳 ${h(c.desc)}</div>
        <div class="m"><span class="pill ${late?'red':'gray'}">${late?'⚠ ':''}${ddmm(c.venc)}</span><span class="pill blue">${c.n} lançamento${c.n!==1?'s':''}</span>${c.informado?`<span class="pill amber" title="Valor da fatura real; lançados somam ${brl(c.calc)}">informado · lançado ${brl(c.calc)}</span>`:'<span>automática</span>'}</div></div>
      <b class="fin-val">${brl(c.valor)}</b></div>`;
  }
  const rec=c.tipo==='receita', apo=c.tipo==='aporte';
  const fora=M&&c.comp===M&&finEfComp(c)!==M;           // pertence a M, mas foi paga com outro mês
  const deFora=M&&c.comp!==M;                            // está aqui porque M adiantou
  return `<div class="list-item ${c.ok?'done':''} ${fora?'fin-fora':''}">
    <div class="check-sq ${c.ok?'on':''}" onclick="finToggleConta('${c.id}')">✓</div>
    <div class="li-body"><div class="t">${apo?'🏦 ':''}${h(c.desc)}</div>
      <div class="m">${deFora?`<span class="pill purple">de ${ymLabel(c.comp)}</span>`:''}
        <span class="pill ${late?'red':'gray'}">${late?'⚠ ':''}${ddmm(c.venc)}</span>
        ${c.modelo?'<span class="pill purple">fixo</span>':''}
        ${fora?`<span class="pill blue" title="Não pesa neste mês">adiantada · paga com ${ymLabel(c.pagoComp)}</span>`:''}
        ${!rec&&!apo&&c.cat&&finCatById(c.cat)?`<span class="tag-dot" style="background:${finCat(c.cat).cor}"></span>${finCat(c.cat).nome}`:''}
        ${c.ok&&c.okEm?`<span>${rec?'recebido':apo?'guardado':'pago'} ${ddmm(c.okEm)}</span>`:''}</div></div>
    <b class="fin-val ${rec?'pos':''}">${brl(c.valor)}</b>
    <button class="icon-btn" onclick="finConta('${c.id}')" title="Editar">✎</button>
    <button class="icon-btn" onclick="finContaDel('${c.id}')" title="Excluir">✕</button></div>`;
}
export function finToggleConta(id){const c=fin.contas.find(x=>x.id===id); if(!c)return;
  c.ok=!c.ok; c.okEm=c.ok?todayISO():''; if(!c.ok) delete c.pagoComp; finSave(); renderCurrent();}
export function finToggleFat(cid,ym){const k=finFatKey(cid,ym); if(fin.faturasPagas[k]) delete fin.faturasPagas[k]; else fin.faturasPagas[k]=todayISO(); finSave(); renderCurrent();}
export function finContaDel(id){const c=fin.contas.find(x=>x.id===id); if(!c)return;
  if(!confirm(`Excluir “${c.desc}” de ${ymLabel(c.comp)}?${c.modelo?'\nO fixo continua existindo para os próximos meses.':''}`))return;
  fin.contas=fin.contas.filter(x=>x.id!==id); finSave(); vFinancas();}
export function finGerarMes(M,silencioso){
  const pend=finFixosPendentes(M);
  pend.forEach(m=>{ const ym=m.mesSeguinte?ymAdd(M,1):M;
    fin.contas.push({id:uid(),tipo:m.tipo,desc:m.desc,valor:m.valor,venc:m.dia?ymDia(ym,m.dia):'',comp:M,ok:false,okEm:'',cat:m.cat||'',modelo:m.id}); });
  finSave();
  if(silencioso) return pend.length;
  vFinancas(); toast(`${pend.length} lançamento${pend.length!==1?'s':''} gerado${pend.length!==1?'s':''} — edite o que variar`);
}

/* ---- adiantar conta de mês futuro ---- */
export function finAdiantar(alvo){
  const M=FIN_ST.comp; alvo=alvo||ymAdd(M,1);
  const lista=fin.contas.filter(c=>c.comp===alvo&&c.tipo==='despesa'&&!c.ok)
    .sort((a,b)=>(a.venc||'9999').localeCompare(b.venc||'9999'));
  const pend=finFixosPendentes(alvo);
  modal(`<h3>Adiantar conta</h3>
    <div class="h-sub" style="margin:-8px 0 12px">Pagar agora, com o dinheiro de <b>${ymLabel(M,true)}</b>, uma conta de um mês futuro. Ela sai do saldo de ${ymLabel(M)} e deixa de pesar no mês dela.</div>
    <div class="field"><label>Conta de qual mês</label><input type="month" id="adM" value="${alvo}" min="${ymAdd(M,1)}" onchange="finAdiantar(this.value)"></div>
    ${pend.length?`<div class="fin-banner"><span>${pend.length} fixo${pend.length>1?'s':''} de ${ymLabel(alvo)} ainda não gerado${pend.length>1?'s':''}</span>
      <button class="btn sm" onclick="finGerarMes('${alvo}',true);finAdiantar('${alvo}')">Gerar para escolher</button></div>`:''}
    ${lista.length?lista.map(c=>`<div class="list-item"><div class="li-body"><div class="t">${h(c.desc)}</div>
        <div class="m"><span class="pill gray">${ddmm(c.venc)}</span>${c.modelo?'<span class="pill purple">fixo</span>':''}</div></div>
        <b class="fin-val">${brl(c.valor)}</b>
        <button class="btn sm ghost" onclick="finAdiantarConfirmar('${c.id}')">Paguei</button></div>`).join('')
      :`<div class="empty" style="padding:18px">Nenhuma conta em aberto em ${ymLabel(alvo)}.</div>`}
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
      <button class="btn" onclick="finConta(null,'despesa',{comp:finVal('adM')||'${alvo}',ok:true,pagoComp:'${M}'})">+ Conta que não está na lista</button></div>`);
}
export function finAdiantarConfirmar(id){
  const c=fin.contas.find(x=>x.id===id); if(!c)return; const M=FIN_ST.comp;
  const v=prompt(`Valor pago em “${c.desc}” (${ymLabel(c.comp)}):`,c.valor.toFixed(2).replace('.',','));
  if(v===null) return;
  c.valor=parseBRL(v)||c.valor; c.ok=true; c.okEm=todayISO(); c.pagoComp=M;
  finSave(); closeModal(); vFinancas(); toast(`${c.desc} de ${ymLabel(c.comp)} paga com ${ymLabel(M)}`);
}

/* conta, receita ou aporte — avulso ou de um fixo */
export function finConta(id,tipo,pre){
  pre=pre||{};
  const c=id?fin.contas.find(x=>x.id===id):null; tipo=c?c.tipo:(tipo||'despesa');
  const rec=tipo==='receita', apo=tipo==='aporte', M=FIN_ST.comp;
  const comp=c?c.comp:(pre.comp||M), ok=c?c.ok:!!pre.ok, pago=c?(c.pagoComp||c.comp):(pre.pagoComp||comp);
  const temModelo=c&&c.modelo&&fin.modelos.some(m=>m.id===c.modelo);
  const nome=rec?'receita':apo?'aporte':'conta';
  modal(`<h3>${c?'Editar':apo?'Novo':'Nova'} ${nome}</h3>
    <div class="field"><label>${apo?'Destino (o nome agrupa o acumulado)':'Descrição'}</label><input id="fcD" value="${c?h(c.desc):''}" placeholder="${rec?'Ex: Salário TRE':apo?'Ex: Reserva de emergência, Tesouro Selic':'Ex: Aluguel, Internet'}" ${apo?'list="fcDest"':''}>
      ${apo?`<datalist id="fcDest">${[...new Set(fin.contas.filter(x=>x.tipo==='aporte').map(x=>x.desc))].map(d=>`<option value="${h(d)}">`).join('')}</datalist>`:''}</div>
    <div class="grid2">
      <div class="field"><label>Valor (R$)</label><input id="fcV" inputmode="decimal" value="${c?c.valor.toFixed(2).replace('.',','):''}"></div>
      <div class="field"><label>${rec?'Data prevista':apo?'Data do aporte':'Vencimento'}</label><input type="date" id="fcVe" value="${c?c.venc:''}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Competência</label><input type="month" id="fcC" value="${comp}"></div>
      ${rec||apo?'<div></div>':`<div class="field"><label>Categoria</label><select id="fcCat" data-fincat data-prev="${c&&c.cat||''}" onchange="finCatSelect(this)">${finCatOptions(c&&c.cat,true)}</select></div>`}
    </div>
    <label class="fin-chk"><input type="checkbox" id="fcOk" ${ok?'checked':''} onchange="document.getElementById('fcPgW').style.display=this.checked?'':'none'"> ${rec?'Já recebido':apo?'Já guardado':'Já pago'}</label>
    ${rec?'<input type="hidden" id="fcPg" value="">':`<div class="field" id="fcPgW" style="${ok?'':'display:none'};margin-top:6px"><label>Pago com o dinheiro de</label><input type="month" id="fcPg" value="${pago}">
      <div class="h-sub" style="margin-top:4px">Igual à competência = normal. Um mês anterior = conta adiantada: pesa no saldo daquele mês.</div></div>`}
    ${!c?`<label class="fin-chk"><input type="checkbox" id="fcFixo"> Repetir todo mês (vira um fixo editável)</label>`:''}
    ${temModelo?`<label class="fin-chk"><input type="checkbox" id="fcProp"> Usar este valor e dia nos próximos meses</label>`:''}
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finSalvarConta(${c?`'${c.id}'`:'null'},'${tipo}')">${c?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>{const e=document.getElementById('fcD'); if(e&&!c)e.focus();},50);
}
export function finSalvarConta(id,tipo){
  const desc=finVal('fcD').trim(); if(!desc){toast('Informe a descrição');return;}
  const valor=parseBRL(finVal('fcV')), venc=finVal('fcVe'), comp=finVal('fcC')||FIN_ST.comp;
  const ok=document.getElementById('fcOk').checked, cat=tipo==='despesa'?finVal('fcCat'):'';
  const pg=finVal('fcPg'); const pagoComp=ok&&pg&&pg!==comp?pg:'';
  if(pagoComp&&pagoComp>comp){toast('“Pago com” não pode ser depois da competência');return;}
  let c=id?fin.contas.find(x=>x.id===id):null;
  if(c){ const eraOk=c.ok; Object.assign(c,{desc,valor,venc,comp,ok,cat}); if(ok&&!eraOk)c.okEm=todayISO(); if(!ok)c.okEm='';
    if(pagoComp) c.pagoComp=pagoComp; else delete c.pagoComp;
    const prop=document.getElementById('fcProp');
    if(prop&&prop.checked){ const m=fin.modelos.find(x=>x.id===c.modelo); if(m){ m.valor=valor; m.dia=venc?+venc.slice(8,10):0; m.desc=desc; m.cat=cat;
      m.mesSeguinte=!!venc&&venc.slice(0,7)!==comp; } }
  }else{
    c={id:uid(),tipo,desc,valor,venc,comp,ok,okEm:ok?todayISO():'',cat,modelo:''};
    if(pagoComp) c.pagoComp=pagoComp;
    const fx=document.getElementById('fcFixo');
    if(fx&&fx.checked){ const m={id:uid(),tipo,desc,valor,dia:venc?+venc.slice(8,10):0,mesSeguinte:!!venc&&venc.slice(0,7)!==comp,cat}; fin.modelos.push(m); c.modelo=m.id; }
    fin.contas.push(c);
  }
  finSave(); closeModal(); vFinancas(); toast(id?'Atualizado':'Adicionado');
}

/* fixos (modelos que geram lançamentos todo mês) */
export function finFixos(){
  const lin=m=>`<div class="list-item"><div class="li-body"><div class="t">${h(m.desc)}</div>
      <div class="m"><span class="pill ${m.tipo==='receita'?'green':m.tipo==='aporte'?'blue':'gray'}">${FIN_TIPOS[m.tipo]}</span>${m.dia?`dia ${m.dia}${m.mesSeguinte?' do mês seguinte':''}`:'sem data'}</div></div>
      <b class="fin-val">${brl(m.valor)}</b>
      <button class="icon-btn" onclick="finModelo('${m.id}')">✎</button><button class="icon-btn" onclick="finModeloDel('${m.id}')">✕</button></div>`;
  const rk={receita:0,despesa:1,aporte:2}; const ord=[...fin.modelos].sort((a,b)=>rk[a.tipo]-rk[b.tipo]||a.dia-b.dia);
  modal(`<h3>Fixos do mês</h3>
    <div class="h-sub" style="margin:-8px 0 12px">São modelos: “Gerar” cria uma cópia editável em cada competência. Mudar o modelo não altera meses já gerados.</div>
    ${ord.length?ord.map(lin).join(''):'<div class="empty">Nenhum fixo ainda.</div>'}
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
      <button class="btn" onclick="finModelo(null)">+ Novo fixo</button></div>`);
}
export function finModelo(id){
  const m=id?fin.modelos.find(x=>x.id===id):null;
  modal(`<h3>${m?'Editar':'Novo'} fixo</h3>
    <div class="grid2">
      <div class="field"><label>Tipo</label><select id="fmT"><option value="despesa" ${!m||m.tipo==='despesa'?'selected':''}>Conta</option><option value="receita" ${m&&m.tipo==='receita'?'selected':''}>Receita</option><option value="aporte" ${m&&m.tipo==='aporte'?'selected':''}>Aporte / reserva</option></select></div>
      <div class="field"><label>Valor padrão (R$)</label><input id="fmV" inputmode="decimal" value="${m?m.valor.toFixed(2).replace('.',','):''}"></div>
    </div>
    <div class="field"><label>Descrição</label><input id="fmD" value="${m?h(m.desc):''}"></div>
    <div class="grid2">
      <div class="field"><label>Dia do vencimento (0 = sem data)</label><input type="number" id="fmDia" min="0" max="31" value="${m?m.dia:10}"></div>
      <div class="field"><label>Categoria</label><select id="fmC" data-fincat data-prev="${m&&m.cat||''}" onchange="finCatSelect(this)">${finCatOptions(m&&m.cat,true)}</select></div>
    </div>
    <label class="fin-chk"><input type="checkbox" id="fmS" ${m&&m.mesSeguinte?'checked':''}> Vence no início do mês seguinte à competência</label>
    <div class="modal-actions"><button class="btn line" onclick="finFixos()">Voltar</button>
      <button class="btn" onclick="finSalvarModelo(${m?`'${m.id}'`:'null'})">Salvar</button></div>`);
}
export function finSalvarModelo(id){
  const desc=finVal('fmD').trim(); if(!desc){toast('Informe a descrição');return;}
  const d={tipo:finVal('fmT'),desc,valor:parseBRL(finVal('fmV')),dia:Math.min(31,Math.max(0,parseInt(finVal('fmDia'))||0)),
    cat:finVal('fmC'),mesSeguinte:document.getElementById('fmS').checked};
  if(id) Object.assign(fin.modelos.find(x=>x.id===id),d); else fin.modelos.push({id:uid(),...d});
  finSave(); vFinancas(); finFixos();
}
export function finModeloDel(id){if(!confirm('Excluir este fixo? Lançamentos já gerados continuam.'))return;
  fin.modelos=fin.modelos.filter(x=>x.id!==id); fin.contas.forEach(c=>{if(c.modelo===id)c.modelo='';}); finSave(); vFinancas(); finFixos();}

/* ---- aba Gastos ---- */
export function finVGastos(){
  const ym=FIN_ST.mesG;
  const gs=fin.gastos.filter(g=>g.data.slice(0,7)===ym);
  const soma=a=>r2(a.reduce((s,g)=>s+g.valor,0));
  const tot=soma(gs), cred=soma(gs.filter(g=>g.meio==='credito')), av=r2(tot-cred);
  const porCat={}; gs.forEach(g=>{porCat[g.cat]=(porCat[g.cat]||0)+g.valor;});
  const cats=Object.entries(porCat).sort((a,b)=>b[1]-a[1]); const max=cats.length?cats[0][1]:1;
  const ant=soma(fin.gastos.filter(g=>g.data.slice(0,7)===ymAdd(ym,-1)));
  // filtro de categoria persiste entre meses; categoria excluída volta para "Todas"
  if(FIN_ST.cat!=='all'&&!finCatById(FIN_ST.cat)) FIN_ST.cat='all';
  const fc=FIN_ST.cat;
  const filt=gs.filter(g=>(FIN_ST.meio==='all'||g.meio===FIN_ST.meio)&&(fc==='all'||g.cat===fc)).sort((a,b)=>b.data.localeCompare(a.data)||(b.criado||0)-(a.criado||0));
  const dias=[...new Set(filt.map(g=>g.data))];
  return `
    <div class="fin-nav">
      <button class="icon-btn" onclick="finMesG(-1)">◀</button>
      <div><b>${ymLabel(ym,true)}</b><small>por data da compra · crédito aparece pelo valor total</small></div>
      <button class="icon-btn" onclick="finMesG(1)">▶</button>
      ${ym!==todayISO().slice(0,7)?`<button class="btn sm line" onclick="finMesG(0)">Atual</button>`:''}
    </div>
    <button class="fin-voice-cta" onclick="finVozAbrir()"><span class="fin-mic sm">🎙</span>
      <span><b>Toque e fale o gasto</b><small>Ex.: “gastei 45 no mercado no débito” — eu repito o que entendi antes de salvar</small></span></button>
    <div class="stat-row" style="margin:18px 0">
      <div class="stat"><b>${brl(tot)}</b><span>${ant?`${tot>=ant?'▲':'▼'} ${Math.abs(Math.round((tot-ant)/ant*100))}% vs mês anterior`:'gasto no mês'}</span></div>
      <div class="stat"><b>${brl(av)}</b><span>à vista (Pix/débito/dinheiro)</span></div>
      <div class="stat"><b>${brl(cred)}</b><span>compras no crédito</span></div>
    </div>
    <div class="row">
      <div class="card" style="flex:1;min-width:260px">
        <h3>Por categoria</h3><div class="h-sub">${gs.length} lançamento${gs.length!==1?'s':''}</div>
        ${cats.length?cats.map(([c,v])=>`<div class="bar-row fin-bar-click ${fc===c?'on':''} ${fc!=='all'&&fc!==c?'dim':''}" onclick="finCatF('${c}',true)" title="Filtrar lançamentos por ${h(finCat(c).nome)}"><div class="lbl">${h(finCat(c).nome)}</div>
          <div class="bar-track"><i style="width:${Math.round(v/max*100)}%;background:${finCat(c).cor}"></i></div>
          <div class="val">${brl(v)}</div></div>`).join(''):'<div class="empty">Sem gastos neste mês.</div>'}
      </div>
      <div class="card" style="flex:1.5;min-width:300px">
        <div class="fin-card-h"><h3>Lançamentos</h3>
          <div class="hist-chips">${[['all','Todos'],...Object.entries(FIN_MEIOS)].map(([k,n])=>`<button class="chip ${FIN_ST.meio===k?'on':''}" onclick="finMeioF('${k}')" style="${FIN_ST.meio===k?'background:var(--ink);color:#fff':''}">${n}</button>`).join('')}</div></div>
        <div class="fin-filtro-cat">
          <select id="finFiltroCat" onchange="finCatF(this.value)" aria-label="Filtrar por categoria">
            <option value="all">Todas as categorias</option>
            ${(()=>{ // categorias com gasto no mês primeiro (com total), depois as demais
              const com=cats.map(([c])=>c), sem=FIN_CATS.map(c=>c.id).filter(id=>!com.includes(id));
              return com.map(c=>`<option value="${c}" ${fc===c?'selected':''}>${h(finCat(c).nome)} · ${brl(porCat[c])}</option>`).join('')
                +(sem.length?`<optgroup label="Sem gastos neste mês">${sem.map(c=>`<option value="${c}" ${fc===c?'selected':''}>${h(finCat(c).nome)}</option>`).join('')}</optgroup>`:'');
            })()}
          </select>
          ${fc!=='all'||FIN_ST.meio!=='all'?`<span class="fin-filtro-tot"><b>${brl(soma(filt))}</b> · ${filt.length} lançamento${filt.length!==1?'s':''}</span>
            <button class="btn sm line" onclick="FIN_ST.cat='all';finMeioF('all')">Limpar filtros</button>`:''}
        </div>
        ${dias.length?dias.map(d=>{const doDia=filt.filter(g=>g.data===d);
          return `<div class="fin-day"><span>${fmtBR(d).slice(0,5)} · ${['dom','seg','ter','qua','qui','sex','sáb'][new Date(d+'T12:00').getDay()]}</span><b>${brl(soma(doDia))}</b></div>
            ${doDia.map(finRowGasto).join('')}`;}).join(''):'<div class="empty">Nada aqui.</div>'}
      </div>
    </div>`;
}
export function finRowGasto(g){
  const c=finCat(g.cat), cart=g.meio==='credito'?(fin.cartoes.find(x=>x.id===g.cartao)||{}).nome:'';
  return `<div class="list-item">
    <span class="tag-dot" style="background:${c.cor}"></span>
    <div class="li-body"><div class="t">${h(g.desc)}</div>
      <div class="m"><span>${c.nome}</span><span class="pill ${g.meio==='credito'?'purple':g.meio==='pix'?'green':'gray'}">${FIN_MEIOS[g.meio]}${cart?' · '+h(cart):''}${g.parc>1?' · '+g.parc+'x':''}</span>
        ${g.origem==='voz'?'<span title="'+h(g.fala||'')+'">🎙</span>':g.origem==='fatura'?'<span title="Importado da fatura">🧾</span>':''}${g.parcIni>1?`<span class="pill gray">desde ${g.parcIni}/${g.parc}</span>`:''}</div></div>
    <b class="fin-val">${brl(g.valor)}</b>
    <button class="icon-btn" onclick="finGastoEditar('${g.id}')" title="Editar">✎</button>
    <button class="icon-btn" onclick="finGastoDel('${g.id}')" title="Excluir">✕</button></div>`;
}

/* ---- aba Cartões ---- */
export function finVCartoes(){
  const hoje=todayISO(), ps=finTodasParcelas();
  if(!fin.cartoes.length) return `<div class="card"><div class="empty">Nenhum cartão cadastrado.<br><br>
    <button class="btn" onclick="finCartao(null)">+ Cadastrar cartão</button></div></div>`;
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn sm ghost" onclick="finCartao(null)">+ Cartão</button></div>`+
  fin.cartoes.map(c=>{
    const mine=ps.filter(p=>p.cartao===c.id);
    const aberta=finFaturaDaCompra(c.id,hoje);
    const valFat=ym=>{const inf=fin.faturasValor[finFatKey(c.id,ym)]; return inf!=null?inf:r2(mine.filter(p=>p.fat===ym).reduce((s,p)=>s+p.valor,0));};
    const mesesInf=Object.keys(fin.faturasValor).filter(k=>k.startsWith(c.id+'_')).map(k=>k.slice(c.id.length+1));
    const todosMeses=[...new Set(mine.map(p=>p.fat).concat(mesesInf))];
    const comprometido=r2(todosMeses.filter(ym=>!fin.faturasPagas[finFatKey(c.id,ym)]).reduce((s,ym)=>s+valFat(ym),0));
    const pctL=c.limite?Math.min(100,Math.round(comprometido/c.limite*100)):0;
    const meses=[...new Set(todosMeses.concat([aberta]))].filter(ym=>ym>=ymAdd(aberta,-2)).sort();
    const proj=[0,1,2,3,4,5].map(k=>{const ym=ymAdd(aberta,k);return [ym,valFat(ym)];});
    const pmax=Math.max(1,...proj.map(x=>x[1]));
    return `<div class="card fin-cc" style="margin-bottom:18px">
      <div class="fin-card-h"><div><h3>💳 ${h(c.nome)} ${fin.cfg.cartaoPadrao===c.id?'<span class="pill purple">padrão</span>':''}</h3>
        <div class="h-sub">fecha dia ${c.fecha} · vence dia ${c.vence} · fatura aberta: ${ymLabel(aberta)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm ghost" onclick="finImpFatura('${c.id}')">⇪ Importar fatura</button><button class="btn sm line" onclick="finNovoCredito('${c.id}')">+ Compra</button>
        <button class="icon-btn" onclick="finCartao('${c.id}')">✎</button></div></div>
      ${c.limite?`<div class="bar-row"><div class="lbl">Limite</div><div class="bar-track"><i style="width:${pctL}%;background:${pctL>85?'var(--red)':pctL>60?'var(--amber)':'var(--purple)'}"></i></div>
        <div class="val">${brl(comprometido)} / ${brl(c.limite)}</div></div>`:`<div class="h-sub">Comprometido (faturas não pagas): <b>${brl(comprometido)}</b></div>`}
      <div class="fin-proj">${proj.map(([ym,v])=>`<div><i style="height:${Math.max(3,Math.round(v/pmax*56))}px"></i><b>${v?brl(v).replace('R$','').trim():'—'}</b><span>${FIN_MESES[+ym.slice(5)-1]}</span></div>`).join('')}</div>
      ${meses.map(ym=>{
        const it=mine.filter(p=>p.fat===ym).sort((a,b)=>a.g.data.localeCompare(b.g.data));
        const calc=r2(it.reduce((s,p)=>s+p.valor,0)), inf=fin.faturasValor[finFatKey(c.id,ym)], tot=inf!=null?inf:calc, pago=!!fin.faturasPagas[finFatKey(c.id,ym)];
        const venc=ymDia(ym,c.vence), late=!pago&&tot>0&&venc<hoje;
        return `<details class="fin-fat" ${ym===aberta?'open':''}>
          <summary><span class="fin-fat-t">${ymLabel(ym)}${ym===aberta?' <span class="pill blue">aberta</span>':''}</span>
            <span class="pill ${late?'red':pago?'green':'gray'}">${pago?'paga':late?'⚠ vencida':'vence'} ${ddmm(venc)}</span>
            <b>${brl(tot)}${inf!=null?`<small class="fin-inf">informado · lançado ${brl(calc)}</small>`:''}</b>
            <button class="icon-btn" title="Informar valor real da fatura" onclick="event.preventDefault();finFatValor('${c.id}','${ym}')">✎</button>
            <button class="btn sm ${pago?'line':'ghost'}" onclick="event.preventDefault();finToggleFat('${c.id}','${ym}')">${pago?'Desfazer':'Paguei'}</button></summary>
          ${it.length?it.map(p=>`<div class="fin-parc"><span class="tag-dot" style="background:${finCat(p.g.cat).cor}"></span>
            <span class="t">${h(p.g.desc)}</span><small>${ddmm(p.g.data)}${p.n>1?` · ${p.k}/${p.n}`:''}</small><b>${brl(p.valor)}</b>
            <button class="icon-btn" onclick="finGastoEditar('${p.g.id}')">✎</button></div>`).join(''):'<div class="empty" style="padding:14px">Sem lançamentos.</div>'}
        </details>`;}).join('')}
    </div>`;}).join('');
}
export function finNovoCredito(cid){
  finConfirmar({valor:0,desc:'',cat:'outros',catSug:'outros',meio:'credito',cartao:cid,parc:1,data:todayISO(),fala:'',flags:[],origem:'manual'});
}
export function finCartao(id){
  const c=id?fin.cartoes.find(x=>x.id===id):null;
  const usos=c?fin.gastos.filter(g=>g.cartao===c.id).length:0;
  modal(`<h3>${c?'Editar':'Novo'} cartão</h3>
    <div class="field"><label>Nome (é como você vai falar: “no Nubank”)</label><input id="kN" value="${c?h(c.nome):''}" placeholder="Nubank"></div>
    <div class="grid2">
      <div class="field"><label>Dia do fechamento</label><input type="number" id="kF" min="1" max="31" value="${c?c.fecha:28}"></div>
      <div class="field"><label>Dia do vencimento</label><input type="number" id="kV" min="1" max="31" value="${c?c.vence:5}"></div>
    </div>
    <div class="field"><label>Limite (opcional)</label><input id="kL" inputmode="decimal" value="${c&&c.limite?c.limite.toFixed(2).replace('.',','):''}"></div>
    <label class="fin-chk"><input type="checkbox" id="kP" ${c&&fin.cfg.cartaoPadrao===c.id?'checked':''}> Cartão padrão quando eu não disser qual</label>
    <div class="modal-actions">
      ${c?`<button class="btn line" style="color:var(--red)" onclick="finCartaoDel('${c.id}')" ${usos?`title="${usos} compras vinculadas"`:''}>Excluir</button>`:''}
      <button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finSalvarCartao(${c?`'${c.id}'`:'null'})">Salvar</button></div>`);
}
export function finSalvarCartao(id){
  const nome=finVal('kN').trim(); if(!nome){toast('Informe o nome');return;}
  const d={nome,fecha:parseInt(finVal('kF'))||1,vence:parseInt(finVal('kV'))||10,limite:parseBRL(finVal('kL'))};
  let c; if(id){c=fin.cartoes.find(x=>x.id===id);Object.assign(c,d);} else {c={id:uid(),...d};fin.cartoes.push(c);}
  if(document.getElementById('kP').checked) fin.cfg.cartaoPadrao=c.id; else if(fin.cfg.cartaoPadrao===c.id) fin.cfg.cartaoPadrao='';
  finSave(); closeModal(); vFinancas(); toast('Cartão salvo');
}
export function finCartaoDel(id){
  const n=fin.gastos.filter(g=>g.cartao===id).length;
  if(n){toast(`${n} compra${n>1?'s':''} usam este cartão — mova ou exclua antes`);return;}
  if(!confirm('Excluir cartão?'))return;
  fin.cartoes=fin.cartoes.filter(x=>x.id!==id);
  ['faturasPagas','faturasValor'].forEach(o=>Object.keys(fin[o]).forEach(k=>{if(k.startsWith(id+'_'))delete fin[o][k];}));
  finSave(); closeModal(); vFinancas();
}

/* ---- valor real da fatura (enquanto o histórico do cartão não está todo lançado) ---- */
export function finFatValor(cid,ym){
  const c=fin.cartoes.find(x=>x.id===cid); if(!c) return;
  const k=finFatKey(cid,ym), inf=fin.faturasValor[k];
  const calc=r2(finTodasParcelas().filter(p=>p.cartao===cid&&p.fat===ym).reduce((s,p)=>s+p.valor,0));
  modal(`<h3>Fatura ${h(c.nome)} · ${ymLabel(ym)}</h3>
    <div class="h-sub" style="margin:-8px 0 12px">Lançado no app: <b>${brl(calc)}</b>. Informe o valor do app do banco quando houver compras antigas que não foram lançadas aqui — ele passa a valer no saldo, e a diferença fica visível.</div>
    <div class="field"><label>Valor real da fatura (vazio = usar o lançado)</label><input id="fvV" inputmode="decimal" value="${inf!=null?inf.toFixed(2).replace('.',','):''}"></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finSalvarFatValor('${cid}','${ym}')">Salvar</button></div>`);
}
export function finSalvarFatValor(cid,ym){
  const raw=finVal('fvV').trim(), k=finFatKey(cid,ym);
  if(raw) fin.faturasValor[k]=parseBRL(raw); else delete fin.faturasValor[k];
  finSave(); closeModal(); vFinancas(); toast(raw?'Valor da fatura informado':'Voltou a usar o valor lançado');
}

/* ---- colar da planilha (Excel/Sheets copia como TSV) ----
   Layout reconhecido: descrição | data (25/set, 01/10) | valor | ok.
   Linhas "Receitas"/"Despesas" trocam a seção; a linha do total é ignorada. */
export const FIN_IMP={rows:[],comp:''};
export const FIN_MES_IDX={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
export function finImpData(cell,comp){
  const m=finNorm(cell).trim().match(/^(\d{1,2})\s*[\/\-.]\s*([a-z]{3,}|\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?$/); if(!m) return null;
  const mes=/^\d+$/.test(m[2])?+m[2]:FIN_MES_IDX[m[2].slice(0,3)]; if(!mes||mes>12) return null;
  let y=+comp.slice(0,4); const cm=+comp.slice(5,7);
  if(m[3]) y=+m[3]<100?2000+ +m[3]:+m[3];
  else if(mes<cm-6) y++; else if(mes>cm+6) y--;
  return ymDia(y+'-'+String(mes).padStart(2,'0'),+m[1]);
}
export function finColar(){
  modal(`<h3>Colar da planilha</h3>
    <div class="h-sub" style="margin:-8px 0 12px">Selecione no Excel da linha “Receitas” até a última despesa (colunas descrição, data, valor, ok), copie e cole aqui.</div>
    <div class="field"><label>Competência destes lançamentos</label><input type="month" id="fiC" value="${FIN_ST.comp}"></div>
    <div class="field"><label>Conteúdo</label><textarea id="fiT" rows="9" placeholder="Receitas\t\t31868,38&#10;Salário Líquido\t\t11874\tok&#10;Despesas\t\t20238,07&#10;Terreno Taquaralto\t25/set\t791\tok"></textarea></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finColarAnalisar()">Analisar</button></div>`);
}
export function finColarAnalisar(){
  const comp=finVal('fiC')||FIN_ST.comp, txt=finVal('fiT'); FIN_IMP.comp=comp;
  let secao='despesa'; const rows=[];
  txt.split(/\r?\n/).forEach(l=>{
    const cells=l.split('\t').map(x=>x.trim()); if(!cells.some(Boolean)) return;
    // cabeçalho de seção = a célula inteira é só a palavra ("Despesas"), nunca "Conta de celular"
    const first=finNorm(cells.find(Boolean)||'').trim();
    if(/^receitas?$/.test(first)){secao='receita';return;}
    if(/^(despesas?|contas?|gastos?|saidas?)$/.test(first)){secao='despesa';return;}
    let desc='',venc='',valor=0,ok=false;
    cells.forEach(cel=>{ if(!cel) return; const n=finNorm(cel);
      if(/^(ok|pago|paga|recebido|x|✓|sim)$/.test(n)){ok=true;return;}
      const d=finImpData(cel,comp); if(d&&!venc){venc=d;return;}
      if(/^-?(r\$\s*)?[\d.,]+$/.test(n)){const v=parseBRL(cel); if(v)valor=v; return;}
      if(!desc) desc=cel; });
    if(!desc||!valor) return;
    const nd=finNorm(desc);
    const tipo=secao==='despesa'&&/\b(reserva|aporte|investimento|poupanca|tesouro|cdb|previdencia)\b/.test(nd)?'aporte':secao;
    const r={desc,venc,valor,ok,tipo,incluir:true,fixo:false,aviso:'',cartao:''};
    if(secao==='despesa'&&/cartao|fatura/.test(nd)){
      const c=fin.cartoes.find(c=>nd.includes(finNorm(c.nome).trim()));
      if(c){ r.cartao=c.id; r.aviso=`vira o valor informado da fatura ${c.nome} (não duplica com as compras lançadas)`;
        if(r.venc&&fin.faturasValor[finFatKey(c.id,r.venc.slice(0,7))]!=null){ r.incluir=false; r.aviso=`fatura ${c.nome} de ${ymLabel(r.venc.slice(0,7))} já tem valor informado`; } }
      else r.aviso='cadastre este cartão na aba Cartões antes — senão ele vira conta comum e duplica com as compras que você lançar';
    }
    if(fin.contas.some(c=>c.comp===comp&&finNorm(c.desc)===nd&&c.tipo===secao)){ r.incluir=false; r.aviso='já existe em '+ymLabel(comp); }
    rows.push(r);
  });
  if(!rows.length){toast('Não reconheci nenhuma linha com descrição e valor');return;}
  FIN_IMP.rows=rows; finColarPreview();
}
export function finColarPreview(){
  const rs=FIN_IMP.rows, sel=rs.filter(r=>r.incluir);
  const tot=t=>r2(sel.filter(r=>t==='despesa'?r.tipo!=='receita':r.tipo===t).reduce((s,r)=>s+r.valor,0));
  modal(`<h3>Conferir importação</h3>
    <div class="h-sub" style="margin:-8px 0 10px">${ymLabel(FIN_IMP.comp,true)} · receitas ${brl(tot('receita'))} · despesas ${brl(tot('despesa'))} · marque “fixo” só no que se repete todo mês</div>
    <div class="table-wrap"><table class="fin-imp"><thead><tr><th></th><th>Lançamento</th><th>Venc.</th><th>Valor</th><th>Fixo</th></tr></thead><tbody>
    ${rs.map((r,i)=>`<tr class="${r.incluir?'':'off'}">
      <td><input type="checkbox" ${r.incluir?'checked':''} onchange="FIN_IMP.rows[${i}].incluir=this.checked;finColarPreview()"></td>
      <td><span class="pill ${r.tipo==='receita'?'green':r.tipo==='aporte'?'blue':'gray'}">${r.tipo==='receita'?'rec':r.tipo==='aporte'?'aporte':'desp'}</span> ${h(r.desc)}${r.ok?' <span class="pill green">ok</span>':''}
        ${r.aviso?`<div class="fin-imp-av">${h(r.aviso)}</div>`:''}</td>
      <td>${r.venc?ddmm(r.venc):'—'}</td><td class="fin-val">${brl(r.valor)}</td>
      <td>${r.cartao?'':`<input type="checkbox" ${r.fixo?'checked':''} onchange="FIN_IMP.rows[${i}].fixo=this.checked">`}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="modal-actions"><button class="btn line" onclick="finColar()">Voltar</button>
      <button class="btn" onclick="finColarImportar()">Importar ${sel.length}</button></div>`);
  const m=document.querySelector('.modal'); if(m) m.style.maxWidth='640px';
}
export function finColarImportar(){
  const M=FIN_IMP.comp; let n=0,f=0;
  FIN_IMP.rows.filter(r=>r.incluir).forEach(r=>{
    if(r.cartao){ const c=fin.cartoes.find(x=>x.id===r.cartao);
      const ym=r.venc?r.venc.slice(0,7):ymAdd(M,1), k=finFatKey(c.id,ym);
      fin.faturasValor[k]=r.valor; if(r.ok) fin.faturasPagas[k]=todayISO(); f++; return; }
    const c={id:uid(),tipo:r.tipo,desc:r.desc,valor:r.valor,venc:r.venc,comp:M,ok:r.ok,okEm:r.ok?todayISO():'',cat:r.tipo==='despesa'?finCategorizar(finNorm(r.desc)).cat:'',modelo:''};
    if(c.cat==='outros') c.cat='';
    if(r.fixo){ const m={id:uid(),tipo:r.tipo,desc:r.desc,valor:r.valor,dia:r.venc?+r.venc.slice(8,10):0,mesSeguinte:!!r.venc&&r.venc.slice(0,7)!==M,cat:c.cat}; fin.modelos.push(m); c.modelo=m.id; }
    fin.contas.push(c); n++;
  });
  FIN_ST.comp=M; FIN_ST.aba='mes'; finSave(); closeModal(); vFinancas();
  toast(`${n} lançamento${n!==1?'s':''} importado${n!==1?'s':''}${f?` · ${f} fatura informada`:''}`);
}

/* ---- importar fatura do cartão (colada do app/PDF do banco) ----
   Cada linha: data · descrição · [parcela k/n] · valor. Parcelada k/n vira UMA compra de n parcelas
   com parcIni=k: as anteriores foram pagas antes do app e não entram em fatura nenhuma; as
   seguintes passam a ser projetadas. Na fatura do mês seguinte a mesma compra reaparece como
   (k+1)/n — o importador reconhece e não duplica. */
export const FIN_FAT={cid:'',ym:'',rows:[]};
export function finFatAbertaParaImportar(c){
  const hoje=todayISO(); let ym=hoje.slice(0,7);
  if(ymDia(ym,c.vence)<hoje) ym=ymAdd(ym,1);          // próxima fatura a vencer = a que acabou de fechar
  return ym;
}
export function finImpFatura(cid){
  const c=fin.cartoes.find(x=>x.id===cid); if(!c) return;
  const ym=FIN_FAT.cid===cid&&FIN_FAT.ym?FIN_FAT.ym:finFatAbertaParaImportar(c);
  modal(`<h3>Importar fatura · ${h(c.nome)}</h3>
    <div class="h-sub" style="margin:-8px 0 12px">No app ou no PDF da fatura, selecione as linhas de lançamentos (data, descrição, valor), copie e cole. Pagamentos da fatura anterior são ignorados sozinhos.</div>
    <div class="field"><label>Fatura com vencimento em</label><input type="month" id="ffM" value="${ym}"></div>
    <div class="field"><label>Lançamentos</label><textarea id="ffT" rows="10" placeholder="12/09 IFD*IFOOD PALMAS 45,90&#10;15/09 UBER *TRIP 18,50&#10;10/07 MAGAZINE LUIZA PARC 03/10 250,00&#10;20/09 ESTORNO LOJA X -30,00"></textarea></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
      <button class="btn" onclick="finImpFaturaAnalisar('${cid}')">Analisar</button></div>`);
}
export function finFatLinha(l,c,ym){
  let t=l.replace(/\t+/g,' ').replace(/\s+/g,' ').trim(); if(!t) return null;
  // valor no fim: 1.234,56 · -30,00 · 30,00- · 30,00 C
  const mv=t.match(/(-)?\s*(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2})\s*(-|C|D)?$/i);
  if(!mv) return null;
  let valor=parseBRL(mv[2]); const neg=!!mv[1]||mv[2].startsWith('-')||mv[3]==='-'||/^c$/i.test(mv[3]||'');
  valor=Math.abs(valor)*(neg?-1:1); t=t.slice(0,mv.index).trim();
  // data no começo: 12/09 · 12/09/26 · 12 SET
  let data='';
  const md=finNorm(t).match(/^(\d{1,2})\s*(?:[\/\-.]\s*(\d{1,2})(?:[\/\-.](\d{2,4}))?|\s+([a-z]{3})[a-z]*)\b/);
  if(md){
    const dia=+md[1], mes=md[2]?+md[2]:FIN_MES_IDX[md[4]];
    if(mes>=1&&mes<=12&&dia>=1&&dia<=31){
      const venc=ymDia(ym,c.vence); let y=md[3]?(+md[3]<100?2000+ +md[3]:+md[3]):+ym.slice(0,4);
      let iso=ymDia(y+'-'+String(mes).padStart(2,'0'),dia);
      if(!md[3]&&iso>venc) iso=ymDia((y-1)+'-'+String(mes).padStart(2,'0'),dia);
      data=iso; t=t.slice(md[0].length).trim();
    }
  }
  // parcela: PARC 03/10 · 3/10 · PARCELA 3 DE 10
  let k=1,n=1; const mp=t.match(/(?:\bparc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  if(mp&&+mp[1]>=1&&+mp[2]>=2&&+mp[2]<=48&&+mp[1]<=+mp[2]){ k=+mp[1]; n=+mp[2]; t=(t.slice(0,mp.index)+' '+t.slice(mp.index+mp[0].length)).trim(); }
  const desc=t.replace(/\s{2,}/g,' ').replace(/[-–·|]+$/,'').trim();
  if(!desc) return null;
  const nd=finNorm(desc);
  if(/^(pagamento|pgto|pag\.? ?fat|saldo|total|subtotal|credito de pagamento|pagto)/.test(nd)) return {ignorar:true,desc,valor};
  return {desc,data:data||ymDia(ymAdd(ym,-1),c.fecha),semData:!data,valor:r2(valor),k,n};
}
export function finImpFaturaAnalisar(cid){
  const c=fin.cartoes.find(x=>x.id===cid); if(!c) return;
  const ym=finVal('ffM'); if(!ym){toast('Informe o mês da fatura');return;}
  FIN_FAT.cid=cid; FIN_FAT.ym=ym;
  const ignoradas=[]; const rows=[];
  finVal('ffT').split(/\r?\n/).forEach(l=>{ const r=finFatLinha(l,c,ym); if(!r) return; if(r.ignorar){ignoradas.push(r);return;} rows.push(r); });
  if(!rows.length){toast('Não reconheci nenhuma linha com valor');return;}
  // candidatos a duplicado: parcelas JÁ existentes que caem nesta fatura
  const existentes=fin.gastos.filter(g=>g.meio==='credito'&&g.cartao===cid)
    .flatMap(g=>finParcelas(g).filter(p=>p.fat===ym));
  const usados=new Set();
  rows.forEach(r=>{
    const {cat}=finCategorizar(finNorm(r.desc).replace(/[^a-z0-9]+/g,' '));
    Object.assign(r,{cat,catSug:cat,incluir:true,aviso:''});
    const dup=existentes.find(p=>!usados.has(p.g.id)&&Math.abs(p.valor-r.valor)<=0.02&&(
      r.n>1 ? (p.n===r.n&&p.k===r.k)
            : ((p.n===1||p.k===1)&&Math.abs((new Date(p.g.data)-new Date(r.data))/864e5)<=4)));   // 1ª parcela às vezes vem sem “01/04”
    if(dup){ usados.add(dup.g.id); r.incluir=false;
      r.aviso=`já está no app: “${dup.g.desc}”${dup.n>1?` ${dup.k}/${dup.n}`:''}${dup.g.origem==='voz'?' (por voz)':dup.g.origem==='fatura'?' (fatura anterior)':''}`; }
    if(r.semData) r.aviso=(r.aviso?r.aviso+' · ':'')+'sem data na linha — usei o fechamento';
  });
  FIN_FAT.rows=rows; FIN_FAT.ignoradas=ignoradas;
  finImpFaturaPreview();
}
export function finImpFaturaPreview(){
  const c=fin.cartoes.find(x=>x.id===FIN_FAT.cid), ym=FIN_FAT.ym, rs=FIN_FAT.rows;
  const k=finFatKey(c.id,ym), inf=fin.faturasValor[k];
  const totLinhas=r2(rs.reduce((s,r)=>s+r.valor,0)), novos=rs.filter(r=>r.incluir);
  const jaNoApp=r2(finTodasParcelas().filter(p=>p.cartao===c.id&&p.fat===ym).reduce((s,p)=>s+p.valor,0));
  const aposImport=r2(jaNoApp+novos.reduce((s,r)=>s+r.valor,0));
  modal(`<h3>Conferir fatura · ${ymLabel(ym)}</h3>
    <div class="fin-fat-res">
      <span>Linhas coladas <b>${brl(totLinhas)}</b></span>
      <span>Fatura no app após importar <b class="${Math.abs(aposImport-totLinhas)<=0.05?'pos':'neg'}">${brl(aposImport)}</b></span>
      ${inf!=null?`<span>Valor informado antes <b>${brl(inf)}</b></span>`:''}
    </div>
    ${Math.abs(aposImport-totLinhas)>0.05?`<div class="fin-flag">⚠ A fatura no app não vai bater com as linhas coladas (${brl(r2(aposImport-totLinhas))}). Geralmente é um lançamento marcado como “já está no app” que na verdade é outro — confira os desmarcados.</div>`:''}
    ${(FIN_FAT.ignoradas||[]).length?`<div class="h-sub">Ignoradas: ${FIN_FAT.ignoradas.map(i=>h(i.desc)+' '+brl(i.valor)).join(' · ')}</div>`:''}
    <div class="table-wrap"><table class="fin-imp"><thead><tr><th></th><th>Data</th><th>Lançamento</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>
    ${rs.map((r,i)=>`<tr class="${r.incluir?'':'off'}">
      <td><input type="checkbox" ${r.incluir?'checked':''} onchange="FIN_FAT.rows[${i}].incluir=this.checked;finImpFaturaPreview()"></td>
      <td>${ddmm(r.data)}</td>
      <td>${h(r.desc)}${r.n>1?` <span class="pill purple">${r.k}/${r.n}</span>`:''}${r.valor<0?' <span class="pill green">crédito</span>':''}
        ${r.aviso?`<div class="fin-imp-av">${h(r.aviso)}</div>`:''}</td>
      <td><select data-fincat data-prev="${r.cat}" onchange="finCatSelect(this);FIN_FAT.rows[${i}].cat=this.value">${finCatOptions(r.cat)}</select></td>
      <td class="fin-val">${brl(r.valor)}</td></tr>`).join('')}
    </tbody></table></div>
    ${inf!=null?`<label class="fin-chk"><input type="checkbox" id="ffInf" checked> Remover o valor informado (${brl(inf)}) — a fatura passa a ser a soma dos lançamentos</label>`:''}
    <div class="modal-actions"><button class="btn line" onclick="finImpFatura('${c.id}')">Voltar</button>
      <button class="btn" onclick="finImpFaturaImportar()">Importar ${novos.length}</button></div>`);
  const m=document.querySelector('.modal'); if(m) m.style.maxWidth='720px';
}
export function finImpFaturaImportar(){
  const cid=FIN_FAT.cid, ym=FIN_FAT.ym; let n=0;
  FIN_FAT.rows.filter(r=>r.incluir).forEach(r=>{
    if(r.cat!==r.catSug) finAprender(r.desc.replace(/[^\p{L}\p{N}]+/gu,' '),r.cat);
    const g={id:uid(),data:r.data,desc:r.desc,cat:r.cat,meio:'credito',cartao:cid,origem:'fatura',criado:Date.now()+n};
    if(r.n>1){ Object.assign(g,{valor:r2(r.valor*r.n),parc:r.n,parcIni:r.k,fatIni:ymAdd(ym,-(r.k-1))}); }
    else Object.assign(g,{valor:r.valor,parc:1,fatIni:ym});   // força esta fatura, independente do dia de fechamento
    fin.gastos.push(g); n++;
  });
  const infBox=document.getElementById('ffInf');
  if(infBox&&infBox.checked) delete fin.faturasValor[finFatKey(cid,ym)];
  FIN_FAT.rows=[]; FIN_FAT.ym='';
  finSave(); closeModal(); FIN_ST.aba='cartoes'; vFinancas();
  toast(`${n} lançamento${n!==1?'s':''} importado${n!==1?'s':''} na fatura de ${ymLabel(ym)}`);
}
