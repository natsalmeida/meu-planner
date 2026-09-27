// views/unitins/aulas.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { aulasDaMateria, materiaNome, materiaOptions, materiaStatus, materiasDoPeriodo, statusPill, syncMateriaStatus, vUnitins } from './hub.js';

/* ---- Aba: Aulas gravadas (agrupadas por matéria) ---- */
export let _aulasMat='all', _aulasEst='todas';
export function setAulasMat(v){_aulasMat=v;vUnitins();}
export function setAulasEst(v){_aulasEst=v;vUnitins();}
/* Uma aula só está "fechada" quando foi assistida E estudada — as duas marcações
   são independentes, então usar só `done` como conclusão esconderia exatamente o
   backlog de revisão que este filtro existe para expor. */
export function aulaEstado(a){return !a.done?'assistir':(!a.estudada?'estudar':'ok');}
export function uniAulas(){
  const mats=materiasDoPeriodo();
  if(!mats.length)
    return `<div class="card"><div class="empty">Cadastre uma matéria neste período primeiro.<br>
      <button class="btn sm ghost" style="margin-top:12px" onclick="setUni('materias')">Ir para Matérias</button></div></div>`;

  // Se o filtro apontar para matéria fora do período selecionado, volta para "todas"
  // — senão a aba abriria vazia sem explicação depois de trocar de período.
  if(_aulasMat!=='all'&&!mats.some(m=>m.id===_aulasMat))_aulasMat='all';
  const todasAulas=mats.flatMap(m=>aulasDaMateria(m.id));
  const nEstado={assistir:0,estudar:0,ok:0};
  todasAulas.forEach(a=>{nEstado[aulaEstado(a)]++;});
  const abertoDaMat=mid=>(mid==='all'?todasAulas:aulasDaMateria(mid)).filter(a=>aulaEstado(a)!=='ok').length;

  const chipsMat=mats.length>1?`<div class="area-tabs" style="margin-bottom:9px;gap:7px">
    <button class="area-tab ${_aulasMat==='all'?'active':''}" onclick="setAulasMat('all')">Todas <b style="opacity:.6">${abertoDaMat('all')}</b></button>
    ${mats.map(m=>`<button class="area-tab ${_aulasMat===m.id?'active':''}" onclick="setAulasMat('${m.id}')">${h(m.nome)} <b style="opacity:.6">${abertoDaMat(m.id)}</b></button>`).join('')}
  </div>`:'';

  const ce=(k,lbl,n)=>`<button class="area-tab ${_aulasEst===k?'active':''}" onclick="setAulasEst('${k}')">${lbl}${n!=null?` <b style="opacity:.6">${n}</b>`:''}</button>`;
  const chipsEst=`<div class="area-tabs" style="margin-bottom:14px;gap:7px">
    ${ce('todas','Qualquer estado',todasAulas.length)}
    ${ce('assistir','⭘ A assistir',nEstado.assistir)}
    ${ce('estudar','📖 Falta estudar',nEstado.estudar)}
    ${ce('ok','✓ Concluídas',nEstado.ok)}
  </div>`;

  const filtroAtivo=_aulasMat!=='all'||_aulasEst!=='todas';
  const estLbl={assistir:'a assistir',estudar:'falta estudar',ok:'concluídas'}[_aulasEst];
  // rótulo separado para caber na frase "Nenhuma aula ___ em X"
  const estFrase={assistir:'pendente de assistir',estudar:'com revisão pendente',ok:'concluída'}[_aulasEst];
  const barra=filtroAtivo?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    ${_aulasMat!=='all'?`<button class="pill gray" style="cursor:pointer" onclick="setAulasMat('all')">✕ matéria: ${h(materiaNome(_aulasMat))}</button>`:''}
    ${_aulasEst!=='todas'?`<button class="pill gray" style="cursor:pointer" onclick="setAulasEst('todas')">✕ estado: ${estLbl}</button>`:''}
  </div>`:'';

  const legenda=`<div class="h-sub" style="margin-bottom:14px">
    <span class="check on" style="width:16px;height:16px;font-size:9px;display:inline-flex;vertical-align:middle">✓</span> assisti ·
    <span class="check-sq on" style="width:16px;height:16px;font-size:9px;display:inline-flex;vertical-align:middle">📖</span> estudei (revisão, exercícios, resumo) — as duas são independentes.</div>`;
  const visiveis=mats.filter(m=>_aulasMat==='all'||m.id===_aulasMat);
  let ocultas=0;
  const blocos=visiveis.map(m=>{
    const aulas=aulasDaMateria(m.id);
    // As barras seguem o TOTAL da matéria, nunca o subconjunto filtrado: um progresso
    // que muda de valor conforme o filtro é um progresso em que não dá para confiar.
    const vistas=aulas.filter(a=>a.done).length;
    const estud=aulas.filter(a=>a.estudada).length;
    const pV=aulas.length?Math.round(vistas/aulas.length*100):0;
    const pE=aulas.length?Math.round(estud/aulas.length*100):0;
    const filtradas=aulas.filter(a=>_aulasEst==='todas'||aulaEstado(a)===_aulasEst);
    if(aulas.length&&!filtradas.length&&_aulasEst!=='todas'){ocultas++;return '';}
    const lista=filtradas.length?filtradas.map(a=>`<div class="list-item ${a.estudada?'done':''}">
        <div class="check ${a.done?'on':''}" onclick="toggleAula('${a.id}')" title="${a.done?'Assistida':'Marcar como assistida'}">${a.done?'✓':''}</div>
        <div class="check-sq ${a.estudada?'on':''}" onclick="toggleAulaEstudo('${a.id}')" title="${a.estudada?'Estudada':'Marcar como estudada'}">${a.estudada?'📖':''}</div>
        <div class="li-body"><div class="t">${h(a.nome)}</div>
          ${a.done&&!a.estudada?'<div class="m"><span class="pill amber">assistida · falta estudar</span></div>':''}</div>
        <button class="icon-btn" onclick="mAula('${a.id}')" title="Editar">✎</button>
        <button class="icon-btn" onclick="delAula('${a.id}')" title="Excluir">✕</button>
      </div>`).join('')
      :'<div class="empty" style="padding:18px">Nenhuma aula cadastrada nesta matéria.</div>';
    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <h3 style="margin:0">${h(m.nome)}</h3>
        ${statusPill(materiaStatus(m))}
        ${m.statusManual?'<span class="pill gray" title="Status travado manualmente">🔒 manual</span>':''}
        ${_aulasEst!=='todas'?`<span class="pill gray">${filtradas.length} de ${aulas.length}</span>`:''}
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn sm line" onclick="mAula(null,'${m.id}')">+ Aula</button>
          <button class="btn sm line" onclick="mGerarAulas('${m.id}')" title="Criar várias aulas numeradas de uma vez">⚡ Série</button>
        </div>
      </div>
      ${aulas.length?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--faint);width:74px">assistidas</span>
          <div class="bar-track" style="height:7px;flex:1"><i style="width:${pV}%;background:var(--purple)"></i></div>
          <span style="font-size:12px;color:var(--muted);white-space:nowrap;width:60px;text-align:right">${vistas}/${aulas.length}</span></div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--faint);width:74px">estudadas</span>
          <div class="bar-track" style="height:7px;flex:1"><i style="width:${pE}%;background:var(--green)"></i></div>
          <span style="font-size:12px;color:var(--muted);white-space:nowrap;width:60px;text-align:right">${estud}/${aulas.length}</span></div>
      </div>`:''}
      ${lista}
    </div>`;}).join('');

  const vazio=!blocos?`<div class="card"><div class="empty">Nenhuma aula ${estFrase||''} ${_aulasMat==='all'?'em nenhuma matéria':'em '+h(materiaNome(_aulasMat))}. 🎉</div></div>`:'';
  const rodape=ocultas?`<div class="h-sub" style="margin-top:-4px">${ocultas} ${ocultas===1?'matéria sem aula':'matérias sem aula'} neste estado ${ocultas===1?'foi omitida':'foram omitidas'}.</div>`:'';
  return chipsMat+chipsEst+barra+legenda+blocos+vazio+rodape;
}
export function mAula(id=null,materiaSel=''){
  const a=id?store.aulas.find(x=>x.id===id):null;
  if(!store.materias.length){toast('Cadastre uma matéria primeiro');return;}
  modal(`<h3>${a?'Editar aula':'Nova aula'}</h3>
  <div class="field"><label>Nome da aula</label><input id="aan" placeholder="Ex: Aula 05 - Derivadas" value="${a?h(a.nome):''}"></div>
  <div class="field"><label>Matéria</label><select id="aam">${materiaOptions(a?a.materia:materiaSel)}</select></div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="saveAula(${a?`'${id}'`:'null'})">${a?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('aan').focus(),50);
}
export function saveAula(id){
  const n=document.getElementById('aan').value.trim(); if(!n){toast('Dê um nome à aula');return;}
  const mat=document.getElementById('aam').value;
  if(id){const a=store.aulas.find(x=>x.id===id);const antiga=a.materia;Object.assign(a,{nome:n,materia:mat});
    if(antiga!==mat)syncMateriaStatus(antiga);}
  else{store.aulas.push({id:uid(),nome:n,materia:mat,done:false,estudada:false});}
  syncMateriaStatus(mat);
  save();closeModal();vUnitins();toast(id?'Aula atualizada':'Aula adicionada');
}
export function mGerarAulas(materiaId){
  modal(`<h3>Gerar série de aulas</h3>
  <div class="field"><label>Matéria</label><select id="gam">${materiaOptions(materiaId)}</select></div>
  <div class="grid2">
    <div class="field"><label>Prefixo</label><input id="gap" value="Aula"></div>
    <div class="field"><label>Quantidade</label><input type="number" id="gaq" min="1" max="200" value="10"></div>
  </div>
  <div class="grid2">
    <div class="field"><label>Começar no número</label><input type="number" id="gai" min="0" value="1"></div>
    <div class="field"><label>Sufixo (opcional)</label><input id="gas" placeholder="Ex: - Módulo I"></div>
  </div>
  <div class="h-sub">Gera "Aula 01", "Aula 02"… numeradas com 2 dígitos, para ordenar corretamente.</div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="gerarAulas()">Gerar</button></div>`);
}
export function gerarAulas(){
  const mat=document.getElementById('gam').value;
  const pre=document.getElementById('gap').value.trim()||'Aula';
  const suf=document.getElementById('gas').value.trim();
  const q=parseInt(document.getElementById('gaq').value)||0;
  const ini=parseInt(document.getElementById('gai').value)||1;
  if(q<1){toast('Informe a quantidade');return;}
  if(q>200){toast('Máximo de 200 por vez');return;}
  const existentes=new Set(store.aulas.filter(a=>a.materia===mat).map(a=>a.nome.toLowerCase()));
  let criadas=0;
  for(let i=0;i<q;i++){
    const nome=`${pre} ${String(ini+i).padStart(2,'0')}${suf?' '+suf:''}`;
    if(existentes.has(nome.toLowerCase()))continue;
    store.aulas.push({id:uid(),nome,materia:mat,done:false,estudada:false});criadas++;
  }
  syncMateriaStatus(mat);
  save();closeModal();vUnitins();
  toast(criadas?`${criadas} aulas criadas`:'Nada criado (nomes já existiam)');
}
export function toggleAulaEstudo(id){
  const a=store.aulas.find(x=>x.id===id); if(!a)return;
  a.estudada=!a.estudada;
  const ch=syncMateriaStatus(a.materia);
  save();vUnitins();
  if(ch)toast(`${materiaNome(a.materia)}: status → ${ch.depois}`);
}
export function toggleAula(id){
  const a=store.aulas.find(x=>x.id===id); if(!a)return;
  a.done=!a.done;
  const ch=syncMateriaStatus(a.materia);
  save();vUnitins();
  if(ch)toast(`${materiaNome(a.materia)}: status → ${ch.depois}`);
}
export function delAula(id){
  const a=store.aulas.find(x=>x.id===id); const mat=a?a.materia:null;
  store.aulas=store.aulas.filter(x=>x.id!==id);
  if(mat)syncMateriaStatus(mat);
  save();vUnitins();
}
