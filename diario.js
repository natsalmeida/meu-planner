// views/diario.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, areaById } from '../core/constantes.js';
import { store } from '../core/store.js';
import { save } from '../core/sync.js';
import { uid } from '../core/app.js';
import { durH, durMin, fmtBR, fmtDur, todayISO } from '../core/datas.js';
import { mostrarAlertaLog, validarLog } from '../features/validacao.js';
import { areaOptions, areaPill, closeModal, h, modal, toast } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';
import { vUnitins } from './unitins/hub.js';

/* ---- Diário de Bordo (motor único: página geral + aba do Hub UNITINS) ----
   ctx='geral'   → todas as áreas, com abas de área
   ctx='unitins' → travado na área UNITINS, sem abas (usado dentro do Hub)
   Cada contexto tem seu próprio estado de filtro, então um não interfere no outro. */
export const DIARIO_ST={geral:{area:'all',ativ:'',busca:'',ini:'',fim:''},unitins:{area:'unitins',ativ:'',busca:'',ini:'',fim:''}};
export function diarioRerender(ctx){ if(ctx==='unitins')vUnitins(); else vDiarios(); }

export function diarioPanel(ctx){
  const st=DIARIO_ST[ctx];
  const sel=st.area, busca=st.busca.trim().toLowerCase();

  const porArea=store.logs.filter(l=>(sel==='all'||l.area===sel)
    &&(!st.ini||l.data>=st.ini)&&(!st.fim||l.data<=st.fim));
  // atividades distintas da área selecionada, com contagem e tempo
  const mapa={};
  porArea.forEach(l=>{const a=(l.atividade||'').trim()||'(sem atividade)';
    if(!mapa[a])mapa[a]={n:0,min:0}; mapa[a].n++; mapa[a].min+=durMin(l.ini,l.fim);});
  const ativs=Object.keys(mapa).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
  if(st.ativ&&!mapa[st.ativ]) st.ativ='';

  const logs=porArea.filter(l=>{
    const at=(l.atividade||'').trim()||'(sem atividade)';
    if(st.ativ&&at!==st.ativ)return false;
    if(busca){const alvo=(at+' '+(l.obs||'')).toLowerCase();if(!alvo.includes(busca))return false;}
    return true;
  }).sort((a,b)=>(b.data+b.ini).localeCompare(a.data+a.ini));

  const contaFiltro=logs.filter(l=>areaById(l.area).conta);
  const totalFiltro=contaFiltro.reduce((s,l)=>s+durH(l.ini,l.fim),0);
  // sessões de trabalho têm total próprio: antes elas apareciam na lista e somavam zero
  const trabFiltro=logs.filter(l=>!areaById(l.area).conta);
  const totalTrab=trabFiltro.reduce((s,l)=>s+durH(l.ini,l.fim),0);
  const filtrando=!!(st.ativ||busca);
  const areaNova=sel==='all'?'':sel;

  return `
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="margin:0;flex:1;min-width:200px">
          <label>Atividade</label>
          <select id="dAtiv_${ctx}" onchange="setDiarioAtiv(this.value,'${ctx}')">
            <option value="">Todas as atividades (${porArea.length})</option>
            ${ativs.map(a=>`<option value="${h(a)}" ${a===st.ativ?'selected':''}>${h(a)} — ${mapa[a].n}× · ${fmtDur(mapa[a].min/60)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0;flex:1;min-width:180px">
          <label>Buscar em atividade/observações</label>
          <input id="dBusca_${ctx}" placeholder="Ex: derivadas, aula 04" value="${h(st.busca)}" oninput="setDiarioBusca(this.value,'${ctx}')">
        </div>
        ${filtrando?`<button class="btn sm line" onclick="limparFiltroDiario('${ctx}')">Limpar filtros</button>`:''}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <span class="pill purple">${logs.length} ${logs.length===1?'sessão':'sessões'}</span>
      ${contaFiltro.length?`<span class="pill green">${fmtDur(totalFiltro)} de estudo no filtro atual</span>`:''}
      ${trabFiltro.length?`<span class="pill gray" title="Trabalho não entra nas horas estudadas — é contabilizado à parte">${fmtDur(totalTrab)} de trabalho (TRE)</span>`:''}
      ${st.ativ?`<span class="pill blue">atividade: ${h(st.ativ)}</span>`:''}
      <button class="btn sm" style="margin-left:auto" onclick="mNovaSessao('${areaNova}')">+ Nova sessão</button>
    </div>
    <div class="card" style="padding:6px 20px">
      ${logs.length?`<div class="table-wrap"><table><thead><tr><th>Data</th>${ctx==='geral'?'<th>Área</th>':''}<th>Atividade</th><th>Observações</th><th>Horário</th><th>Duração</th><th></th></tr></thead>
      <tbody>${logs.map(l=>`<tr>
        <td>${fmtBR(l.data)}</td>${ctx==='geral'?`<td>${areaPill(l.area)}</td>`:''}<td>${h(l.atividade||'—')}</td>
        <td style="color:var(--muted);max-width:220px">${l.obs?h(l.obs):'—'}</td>
        <td>${l.ini}–${l.fim}</td><td><b>${fmtDur(durH(l.ini,l.fim))}</b></td>
        <td style="white-space:nowrap"><button class="icon-btn" onclick="mNovaSessao(null,'${l.id}')" title="Editar">✎</button><button class="icon-btn" onclick="delLog('${l.id}')" title="Excluir">✕</button></td></tr>`).join('')}</tbody></table></div>`
      :`<div class="empty">${filtrando?'Nenhuma sessão com esse filtro.':'Nenhuma sessão registrada ainda.'}</div>`}
    </div>`;
}

export function vDiarios(){
  const sel=DIARIO_ST.geral.area;
  const tabs=`<button class="area-tab ${sel==='all'?'active':''}" onclick="setDiario('all')">Todas</button>`+
    AREAS.map(a=>`<button class="area-tab ${sel===a.id?'active':''}" onclick="setDiario('${a.id}')">${a.nome}</button>`).join('');
  document.getElementById('view').innerHTML=`
    <div class="page-title">diários de bordo</div>
    <div class="page-sub">Toda sessão registrada aqui — manualmente, pelo cronômetro ou pelo botão da Grade — alimenta as horas, a aderência semanal e o hábito "Estudo". Lançamentos de TRE têm total próprio, em cinza: contam como carga de trabalho, nunca como estudo.</div>
    <div class="area-tabs">${tabs}</div>
    ${diarioPanel('geral')}`;
}
export function setDiario(a){DIARIO_ST.geral.area=a;DIARIO_ST.geral.ativ='';DIARIO_ST.geral.busca='';vDiarios();}
export function setDiarioAtiv(v,ctx='geral'){DIARIO_ST[ctx].ativ=v;diarioRerender(ctx);}
export function setDiarioBusca(v,ctx='geral'){DIARIO_ST[ctx].busca=v;diarioRerender(ctx);
  const el=document.getElementById('dBusca_'+ctx);
  if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}}
export function limparFiltroDiario(ctx='geral'){DIARIO_ST[ctx].ativ='';DIARIO_ST[ctx].busca='';diarioRerender(ctx);}
export function delLog(id){store.logs=store.logs.filter(l=>l.id!==id);save();renderCurrent();}
export function recentActivities(area){
  // atividades únicas mais recentes SOMENTE da área selecionada
  const seen=new Set(); const out=[];
  [...store.logs].sort((a,b)=>(b.data+b.ini).localeCompare(a.data+a.ini))
    .filter(l=>l.area===area).forEach(l=>{const a=(l.atividade||'').trim();
      if(a&&!seen.has(a)){seen.add(a);out.push(a);}});
  return out.slice(0,10);
}
export function mNovaSessao(areaSel='',editId=null,prefill=null){
  const ed = editId?store.logs.find(l=>l.id===editId):null;
  const areaEff = ed?ed.area:(prefill?prefill.area:(areaSel||'unitins'));
  const rec=recentActivities(areaEff);
  const chips = rec.length ? `<div class="hist-chips" id="histChips">${rec.map(a=>
    `<button type="button" class="chip" onclick="document.getElementById('sat').value=this.textContent">${h(a)}</button>`).join('')}</div>` : '';
  const atividadeVal = ed?(ed.atividade||''):(prefill?(prefill.atividade||''):'');
  const dataVal = ed?ed.data:(prefill?prefill.data:todayISO());
  const iniVal = ed?ed.ini:(prefill?prefill.ini:'');
  const fimVal = ed?ed.fim:(prefill?prefill.fim:'');
  const obsVal = ed?(ed.obs||''):(prefill?(prefill.obs||''):'');
  const saidaVal = ed?!!ed.saida:(prefill?!!prefill.saida:false);
  modal(`<h3>${ed?'Editar sessão':(prefill&&prefill.origem==='timer')?'Salvar sessão do cronômetro':'Nova sessão de estudo'}</h3>
  ${(prefill&&prefill.origem==='timer')?(prefill.timerLongo
    ?`<div class="log-alert aviso" style="margin:0 0 14px"><b>Cronômetro ligado por ${fmtDur(prefill.timerLongo)}</b>Provavelmente ficou esquecido. Informe o horário real de fim.</div>`
    :`<div class="pill purple" style="margin-bottom:14px">⏱ Tempo cronometrado: ${fmtDur(durH(iniVal,fimVal))}</div>`):''}
  <div class="field"><label>Área</label><select id="sa" onchange="refreshHistChips(this.value)">${areaOptions(areaEff)}</select></div>
  <div class="field"><label>Atividade</label><input id="sat" placeholder="Ex: Busuu, BBC, Aula 04 de Cálculo" value="${h(atividadeVal)}">
    ${rec.length?`<div style="font-size:11px;color:var(--faint);margin:7px 0 4px" id="histLabel">Últimas atividades desta área (toque para reaproveitar):</div>`:`<div style="font-size:11px;color:var(--faint);margin:7px 0 4px;display:none" id="histLabel">Últimas atividades desta área (toque para reaproveitar):</div>`}${chips||'<div class="hist-chips" id="histChips"></div>'}</div>
  <div class="field"><label>Data</label><input type="date" id="sd" value="${dataVal}"></div>
  <div class="grid2">
    <div class="field"><label>Hora início</label><input type="time" id="si" value="${iniVal}"></div>
    <div class="field"><label>Hora fim</label><input type="time" id="sf" value="${fimVal}"></div>
  </div>
  <label class="chk-line"><input type="checkbox" id="ssa" ${saidaVal?'checked':''}>
    <span>Produção ativa<small>Falar, escrever, resolver. Desmarcado = consumo (assistir, ler, ouvir).</small></span></label>
  <div class="field"><label>Observações (opcional)</label><textarea id="so" rows="2">${h(obsVal)}</textarea></div>
  <div id="logAlert"></div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" id="logSalvar" onclick="addLog(${ed?`'${editId}'`:'null'})">${ed?'Salvar':'Salvar sessão'}</button></div>`);}
export function refreshHistChips(area){
  const rec=recentActivities(area);const box=document.getElementById('histChips');const lbl=document.getElementById('histLabel');if(!box)return;
  box.innerHTML=rec.map(a=>`<button type="button" class="chip" onclick="document.getElementById('sat').value=this.textContent">${h(a)}</button>`).join('');
  if(lbl)lbl.style.display=rec.length?'block':'none';
}
export function addLog(editId=null,confirmado=false){const area=document.getElementById('sa').value,ini=document.getElementById('si').value,fim=document.getElementById('sf').value;
  const dados={area,atividade:document.getElementById('sat').value.trim(),
    data:document.getElementById('sd').value,ini,fim,obs:document.getElementById('so').value.trim(),
    saida:!!(document.getElementById('ssa')||{}).checked};
  const r=validarLog(dados,editId);
  if(r.bloq.length||(r.avisos.length&&!confirmado)){ mostrarAlertaLog(r,editId); return; }
  if(editId){Object.assign(store.logs.find(l=>l.id===editId),dados);}
  else{store.logs.push({id:uid(),...dados});}
  save();closeModal();
  if(!areaById(area).conta)toast('Sessão salva (TRE não conta como estudo)');else toast(editId?'Sessão atualizada':'Sessão salva');
  renderCurrent();}
