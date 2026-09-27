// views/unitins/entregaveis.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { fmtBR, todayISO } from '../../core/datas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { aulasDaMateria, materiaNome, materiaOptions, materiasDoPeriodo, vUnitins } from './hub.js';
import { addDaysISO } from '../analytics/graficos.js';

export let _entregMat='all', _entregEst='aberto';
export function setEntregMat(v){_entregMat=v;vUnitins();}
export function setEntregEst(v){_entregEst=v;vUnitins();}
export function entregaveisDaMateria(id){
  return store.entregaveis.filter(e=>e.materia===id)
    .sort((a,b)=>(a.prazo||'9999-99-99').localeCompare(b.prazo||'9999-99-99')
      ||String(a.nome).localeCompare(String(b.nome),'pt-BR',{numeric:true,sensitivity:'base'}));
}
/* Estado derivado: atraso NUNCA é digitado, é consequência do prazo. */
export function entregState(e){
  if(e.status==='Entregue')return 'entregue';
  if(e.prazo&&e.prazo<todayISO())return 'atrasado';
  return e.status==='Em andamento'?'andamento':'afazer';
}
export function entregNoEstado(e){
  const st=entregState(e);
  if(_entregEst==='todos')return true;
  if(_entregEst==='aberto')return st!=='entregue';
  return st===_entregEst;
}
export function uniEntregaveis(){
  const mats=materiasDoPeriodo();
  if(!mats.length)
    return `<div class="card"><div class="empty">Cadastre uma matéria neste período primeiro.<br>
      <button class="btn sm ghost" style="margin-top:12px" onclick="setUni('materias')">Ir para Matérias</button></div></div>`;
  // filtro apontando para matéria fora do período volta a "todas": senão a aba
  // abriria vazia, sem explicação, depois de trocar de semestre.
  if(_entregMat!=='all'&&!mats.some(m=>m.id===_entregMat))_entregMat='all';

  const todos=mats.flatMap(m=>entregaveisDaMateria(m.id));
  const n={afazer:0,andamento:0,atrasado:0,entregue:0};
  todos.forEach(e=>{n[entregState(e)]++;});
  const aberto=n.afazer+n.andamento+n.atrasado;
  const limite7=addDaysISO(todayISO(),7);
  const vence7=todos.filter(e=>entregState(e)!=='entregue'&&entregState(e)!=='atrasado'
    &&e.prazo&&e.prazo<=limite7).length;
  const pctGeral=todos.length?Math.round(n.entregue/todos.length*100):0;
  const abertoDaMat=mid=>(mid==='all'?todos:entregaveisDaMateria(mid)).filter(e=>entregState(e)!=='entregue').length;

  const resumo=`<div class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <span style="font-family:var(--serif);font-size:30px;font-weight:600;color:var(--blue)">${pctGeral}%</span>
      <span style="color:var(--muted);font-size:15px">${n.entregue} de ${todos.length} entregues no período</span>
      <span style="margin-left:auto;display:flex;gap:7px;flex-wrap:wrap;align-items:center">
        ${n.atrasado?`<button class="pill red" style="cursor:pointer" onclick="setEntregEst('atrasado')" title="Ver só os atrasados">⚠ ${n.atrasado} atrasado${n.atrasado>1?'s':''}</button>`:''}
        ${vence7?`<span class="pill amber">⏳ ${vence7} vence${vence7>1?'m':''} em 7 dias</span>`:''}
        <span class="pill gray">${aberto} em aberto</span>
        <button class="btn sm" onclick="mEntreg()">+ Novo entregável</button>
      </span>
    </div>
    <div class="bar-track" style="height:11px"><i style="width:${pctGeral}%;background:linear-gradient(90deg,var(--blue),var(--green))"></i></div>
  </div>`;

  const chipsMat=mats.length>1?`<div class="area-tabs" style="margin-bottom:9px;gap:7px">
    <button class="area-tab ${_entregMat==='all'?'active':''}" onclick="setEntregMat('all')">Todas <b style="opacity:.6">${abertoDaMat('all')}</b></button>
    ${mats.map(m=>`<button class="area-tab ${_entregMat===m.id?'active':''}" onclick="setEntregMat('${m.id}')">${h(m.nome)} <b style="opacity:.6">${abertoDaMat(m.id)}</b></button>`).join('')}
  </div>`:'';

  const ce=(k,lbl,q)=>`<button class="area-tab ${_entregEst===k?'active':''}" onclick="setEntregEst('${k}')">${lbl} <b style="opacity:.6">${q}</b></button>`;
  const chipsEst=`<div class="area-tabs" style="margin-bottom:12px;gap:7px">
    ${ce('aberto','⭘ Em aberto',aberto)}
    ${ce('atrasado','⚠ Atrasados',n.atrasado)}
    ${ce('andamento','◐ Em andamento',n.andamento)}
    ${ce('entregue','✓ Entregues',n.entregue)}
    ${ce('todos','Tudo',todos.length)}
  </div>`;

  const legenda=`<div class="h-sub" style="margin-bottom:14px">
    <span class="check on" style="width:16px;height:16px;font-size:9px;display:inline-flex;vertical-align:middle">✓</span> entreguei ·
    <span class="check-sq wip on" style="width:16px;height:16px;font-size:9px;display:inline-flex;vertical-align:middle">◐</span> comecei —
    o atraso não se marca à mão: aparece sozinho quando o prazo passa sem entrega.</div>`;

  const visiveis=mats.filter(m=>_entregMat==='all'||m.id===_entregMat);
  let ocultas=0;
  const blocos=visiveis.map(m=>{
    const lista=entregaveisDaMateria(m.id);
    const ent=lista.filter(e=>e.status==='Entregue').length;
    const atr=lista.filter(e=>entregState(e)==='atrasado').length;
    const pct=lista.length?Math.round(ent/lista.length*100):0;
    const filtradas=lista.filter(entregNoEstado);
    // matéria sem nada a mostrar neste filtro sai da tela, mas é contabilizada no rodapé
    if(!filtradas.length&&(lista.length||_entregEst!=='aberto')&&_entregEst!=='todos'){ocultas++;return '';}

    const linhas=filtradas.length?filtradas.map(e=>{
      const st=entregState(e);
      const feito=st==='entregue';
      return `<div class="list-item ${feito?'done':''}">
        <div class="check ${feito?'on':''}" onclick="toggleEntregue('${e.id}')" title="${feito?'Entregue — clique para reabrir':'Marcar como entregue'}">${feito?'✓':''}</div>
        <div class="check-sq wip ${st==='andamento'?'on':''}" onclick="toggleEntregAndamento('${e.id}')" title="${st==='andamento'?'Em andamento':'Marcar como em andamento'}">${st==='andamento'?'◐':''}</div>
        <div class="li-body"><div class="t">${h(e.nome)}</div>
          <div class="m">
            ${e.prazo?`<span class="pill ${st==='atrasado'?'red':'gray'}">${st==='atrasado'?'⚠ ':''}${fmtBR(e.prazo)}</span>`
                     :'<span class="pill gray">sem prazo</span>'}
            ${feito?'':urgPill(e)}
          </div></div>
        <button class="icon-btn" onclick="mEntreg('${e.id}')" title="Editar">✎</button>
        <button class="icon-btn" onclick="delEntreg('${e.id}')" title="Excluir">✕</button>
      </div>`;}).join('')
      :`<div class="empty" style="padding:18px">Nenhum entregável cadastrado nesta matéria.</div>`;

    return `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <h3 style="margin:0">${h(m.nome)}</h3>
        ${atr?`<span class="pill red">⚠ ${atr} atrasado${atr>1?'s':''}</span>`
             :(lista.length&&ent===lista.length?'<span class="pill green">tudo entregue</span>':'')}
        ${_entregEst!=='todos'&&lista.length?`<span class="pill gray" title="Itens visíveis no filtro atual, de ${lista.length} cadastrados nesta matéria">${filtradas.length} no filtro</span>`:''}
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn sm line" onclick="mEntreg(null,'${m.id}')">+ Entregável</button>
          <button class="btn sm line" onclick="mGerarEntregaveis('${m.id}')" title="Criar vários entregáveis numerados com o mesmo prazo">⚡ Série</button>
        </div>
      </div>
      ${lista.length?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:11px;color:var(--faint);width:74px">entregues</span>
        <div class="bar-track" style="height:7px;flex:1"><i style="width:${pct}%;background:var(--blue)"></i></div>
        <span style="font-size:12px;color:var(--muted);white-space:nowrap;width:60px;text-align:right">${ent}/${lista.length}</span></div>`:''}
      ${linhas}
    </div>`;}).join('');

  const estFrase={aberto:'em aberto',atrasado:'atrasado',andamento:'em andamento',entregue:'entregue',todos:''}[_entregEst];
  const vazio=!blocos?`<div class="card"><div class="empty">Nenhum entregável ${estFrase} ${_entregMat==='all'?'em nenhuma matéria':'em '+h(materiaNome(_entregMat))}. 🎉</div></div>`:'';
  const rodape=ocultas?`<div class="h-sub" style="margin-top:-4px">${ocultas} ${ocultas===1?'matéria sem entregável':'matérias sem entregável'} neste estado ${ocultas===1?'foi omitida':'foram omitidas'}.</div>`:'';
  return resumo+chipsMat+chipsEst+legenda+blocos+vazio+rodape;
}
export function urgPill(e){if(e.status==='Entregue')return '<span class="pill green">✓ Concluído</span>';
  if(!e.prazo)return '<span class="pill gray">sem prazo</span>';
  const d=Math.ceil((new Date(e.prazo+'T00:00')-new Date(todayISO()+'T00:00'))/86400000);
  if(d<0)return '<span class="pill red">⚠ Atrasado</span>';
  if(d<=1)return '<span class="pill red">🔴 Urgente</span>';
  if(d<=4)return '<span class="pill amber">🟡 Atenção</span>';
  return '<span class="pill green">🟢 Tranquilo</span>';}
/* Criar E editar no mesmo modal — antes não existia edição nenhuma: corrigir um
   prazo digitado errado exigia excluir e recadastrar, perdendo o item do histórico. */
export function mEntreg(id=null,materiaSel=''){
  if(!store.materias.length){toast('Cadastre uma matéria primeiro');return;}
  const e=id?store.entregaveis.find(x=>x.id===id):null;
  modal(`<h3>${e?'Editar entregável':'Novo entregável'}</h3>
  <div class="field"><label>Nome</label><input id="een" placeholder="Ex: Atividade Aula 05" value="${e?h(e.nome):''}"></div>
  <div class="grid2">
    <div class="field"><label>Matéria</label><select id="eem">${materiaOptions(e?e.materia:materiaSel)}</select></div>
    <div class="field"><label>Situação</label><select id="ees">
      ${['A fazer','Em andamento','Entregue'].map(x=>`<option ${(e?e.status:'A fazer')===x?'selected':''}>${x}</option>`).join('')}
    </select></div>
  </div>
  <div class="field"><label>Prazo</label><input type="date" id="eed" value="${e?h(e.prazo||''):''}"></div>
  <div class="h-sub" style="margin-top:-4px">"Atrasado" não é mais uma opção de situação: ele é calculado pelo prazo. Assim não dá para ter um item vencido marcado como "A fazer" nem um item no prazo marcado como atrasado.</div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="saveEntreg(${e?`'${id}'`:'null'})">${e?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('een').focus(),50);
}
export function mNovoEntreg(){mEntreg();}   // mantido: o Dashboard e atalhos antigos chamam por este nome
export function saveEntreg(id){
  const n=document.getElementById('een').value.trim(); if(!n){toast('Dê um nome ao entregável');return;}
  const dados={nome:n,materia:document.getElementById('eem').value,
    status:document.getElementById('ees').value,prazo:document.getElementById('eed').value};
  if(id){Object.assign(store.entregaveis.find(x=>x.id===id),dados);}
  else{store.entregaveis.push({id:uid(),...dados});}
  save();closeModal();vUnitins();toast(id?'Entregável atualizado':'Entregável adicionado');
}
/* Série: seus entregáveis seguem o padrão "Atividade Aula NN" com um prazo comum
   por bloco de aulas. Criar 5 à mão é o tipo de trabalho que o app devia absorver. */
export function mGerarEntregaveis(materiaId){
  const nAulas=aulasDaMateria(materiaId).length;
  modal(`<h3>Gerar série de entregáveis</h3>
  <div class="field"><label>Matéria</label><select id="gem">${materiaOptions(materiaId)}</select></div>
  <div class="grid2">
    <div class="field"><label>Prefixo</label><input id="gep" value="Atividade Aula"></div>
    <div class="field"><label>Quantidade</label><input type="number" id="geq" min="1" max="100" value="${Math.max(1,Math.min(10,nAulas||5))}"></div>
  </div>
  <div class="grid2">
    <div class="field"><label>Começar no número</label><input type="number" id="gei" min="0" value="1"></div>
    <div class="field"><label>Prazo (o mesmo para todos)</label><input type="date" id="ged" value=""></div>
  </div>
  <div class="h-sub">Gera "Atividade Aula 05", "Atividade Aula 06"… numeradas com 2 dígitos. Nomes que já existem nesta matéria são ignorados, então dá para rodar de novo depois sem duplicar nada.</div>
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="gerarEntregaveis()">Gerar</button></div>`);
}
export function gerarEntregaveis(){
  const mat=document.getElementById('gem').value;
  const pre=document.getElementById('gep').value.trim()||'Atividade';
  const q=parseInt(document.getElementById('geq').value)||0;
  const ini=parseInt(document.getElementById('gei').value)||1;
  const prazo=document.getElementById('ged').value;
  if(q<1){toast('Informe a quantidade');return;}
  if(q>100){toast('Máximo de 100 por vez');return;}
  const existentes=new Set(store.entregaveis.filter(e=>e.materia===mat).map(e=>String(e.nome).toLowerCase()));
  let criados=0;
  for(let i=0;i<q;i++){
    const nome=`${pre} ${String(ini+i).padStart(2,'0')}`;
    if(existentes.has(nome.toLowerCase()))continue;
    store.entregaveis.push({id:uid(),nome,materia:mat,status:'A fazer',prazo});criados++;
  }
  save();closeModal();vUnitins();
  toast(criados?`${criados} entregáveis criados`:'Nada criado (nomes já existiam)');
}
export function toggleEntregue(id){
  const e=store.entregaveis.find(x=>x.id===id); if(!e)return;
  e.status=(e.status==='Entregue')?'A fazer':'Entregue';
  save();vUnitins();
  toast(e.status==='Entregue'?'✓ Entregue':'Reaberto');
}
export function toggleEntregAndamento(id){
  const e=store.entregaveis.find(x=>x.id===id); if(!e)return;
  if(e.status==='Entregue'){toast('Já entregue — desmarque a entrega antes');return;}
  e.status=(e.status==='Em andamento')?'A fazer':'Em andamento';
  save();vUnitins();
}
export function delEntreg(id){store.entregaveis=store.entregaveis.filter(e=>e.id!==id);save();vUnitins();}

/* Heatmap anual parametrizável. studyHeatmap() e o mapa de trabalho compartilham
   a mesma malha; só mudam a fonte das horas, a cor e os cortes de intensidade. */
