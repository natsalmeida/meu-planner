// views/pendencias.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../core/store.js';
import { save } from '../core/sync.js';
import { uid } from '../core/app.js';
import { fmtBR, todayISO } from '../core/datas.js';
import { isAtrasado } from '../core/horas.js';
import { areaOptions, areaPill, closeModal, h, modal, toast } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';

export function novaPendenciaNoDia(iso,ev){
  if(ev&&ev.target&&ev.target.closest&&ev.target.closest('.cal-ev,.cal-more'))return; // clique num evento não cria
  mPendencia(); setTimeout(()=>{const d=document.getElementById('pd'); if(d)d.value=iso;},60);
}

export function vPendencias(){
  const abertas=store.pendencias.filter(p=>!p.done);
  const feitas=store.pendencias.filter(p=>p.done);
  const urg=abertas.filter(p=>p.prio==='Alta').length;
  const atras=abertas.filter(p=>isAtrasado(p.prazo,p.done)).length;
  const render=p=>{const late=isAtrasado(p.prazo,p.done);
    return `<div class="list-item ${p.done?'done':''}">
    <div class="check ${p.done?'on':''}" onclick="togglePend('${p.id}')">${p.done?'✓':''}</div>
    <div class="li-body"><div class="t">${h(p.nome)}</div>
    <div class="m">${p.area?areaPill(p.area):''} ${p.prio?`<span class="pill ${p.prio==='Alta'?'red':p.prio==='Média'?'amber':'gray'}">${p.prio}</span>`:''} ${p.prazo?`<span class="pill ${late?'red':'gray'}">${late?'⚠ ':''}${fmtBR(p.prazo)}</span>`:''}</div></div>
    <button class="icon-btn" onclick="mPendencia('${p.id}')" title="Editar">✎</button>
    <button class="icon-btn" onclick="delPend('${p.id}')" title="Excluir">✕</button></div>`;};
  document.getElementById('view').innerHTML=`
    <div class="page-title">pendências</div>
    <div class="page-sub">Coisas que você precisa resolver e têm data — de estudos ou pessoais. Marque a área só quando fizer sentido; se for algo pessoal, deixe sem área. Não entra na contagem de horas.</div>
    <div style="display:flex;gap:10px;margin-bottom:18px;align-items:center">
      <span class="pill purple">${abertas.length} abertas</span>
      <span class="pill red">${urg} urgentes</span>
      ${atras?`<span class="pill red">⚠ ${atras} atrasadas</span>`:''}
      <button class="btn sm" style="margin-left:auto" onclick="mPendencia()">+ Nova pendência</button>
    </div>
    <div class="card">${abertas.length?abertas.map(render).join(''):'<div class="empty">Nenhuma pendência aberta. 🎉</div>'}</div>
    ${feitas.length?`<div class="card" style="margin-top:16px"><h3>Concluídas</h3><div class="h-sub">${feitas.length} itens</div>${feitas.map(render).join('')}</div>`:''}`;
}
export function togglePend(id){const p=store.pendencias.find(x=>x.id===id);p.done=!p.done;save();vPendencias();}
export function delPend(id){store.pendencias=store.pendencias.filter(x=>x.id!==id);save();vPendencias();}
export function mPendencia(id=null){const p=id?store.pendencias.find(x=>x.id===id):null;
  modal(`<h3>${p?'Editar pendência':'Nova pendência'}</h3>
  <div class="field"><label>O que você precisa resolver</label><input id="pn" placeholder="Ex: Ir ao dentista, enviar atividade de Cálculo" value="${p?h(p.nome):''}"></div>
  <div class="grid2">
    <div class="field"><label>Prazo</label><input type="date" id="pd" value="${p?p.prazo:todayISO()}"></div>
    <div class="field"><label>Prioridade</label><select id="pp">${['Baixa','Média','Alta'].map(x=>`<option ${(p?p.prio:'Média')===x?'selected':''}>${x}</option>`).join('')}</select></div>
  </div>
  <div class="field"><label>Área (opcional — deixe vazio se for pessoal)</label><select id="pa"><option value="">— Nenhuma —</option>${areaOptions(p?p.area:'')}</select></div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="savePend(${p?`'${id}'`:'null'})">${p?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('pn').focus(),50);}
export function savePend(id){const n=document.getElementById('pn').value.trim();if(!n)return;
  const dados={nome:n,area:document.getElementById('pa').value,prio:document.getElementById('pp').value,prazo:document.getElementById('pd').value};
  if(id){Object.assign(store.pendencias.find(x=>x.id===id),dados);}
  else{store.pendencias.push({id:uid(),...dados,done:false});}
  save();closeModal();renderCurrent();toast(id?'Pendência atualizada':'Pendência adicionada');}
