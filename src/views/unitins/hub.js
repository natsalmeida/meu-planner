// views/unitins/hub.js — gerado a partir do monólito; edite aqui a partir de agora.
import { periodoAtivo, periodoById, periodoEncerrado, periodoLabel } from '../../core/periodos.js';
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { durH, fmtBR, fmtDur, todayISO } from '../../core/datas.js';
import { countableLogs } from '../../core/horas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { DIARIO_ST, diarioPanel } from '../diario.js';
import { uniAulas } from './aulas.js';
import { uniSincronas } from './sincronas.js';
import { entregState, entregaveisDaMateria, uniEntregaveis } from './entregaveis.js';

export function materiaStatusAuto(id){
  const aulas=store.aulas.filter(a=>a.materia===id);
  if(!aulas.length) return null;                       // sem aulas não há o que inferir
  const vistas=aulas.filter(a=>a.done).length;
  const estud=aulas.filter(a=>a.estudada).length;
  if(vistas===0&&estud===0) return 'Não iniciada';
  // "Concluída" só exige estudo se você usa o marcador 📖 nesta matéria
  const usaEstudo=estud>0;
  if(vistas===aulas.length && (!usaEstudo || estud===aulas.length)) return 'Concluída';
  return 'Em andamento';
}
export function materiaStatus(m){
  if(!m) return 'Não iniciada';
  if(m.statusManual) return m.status||'Não iniciada';
  return materiaStatusAuto(m.id) || m.status || 'Não iniciada';
}
/* recalcula e persiste o status quando a matéria está em modo automático */
export function syncMateriaStatus(materiaId){
  const m=store.materias.find(x=>x.id===materiaId);
  if(!m||m.statusManual) return null;
  const auto=materiaStatusAuto(materiaId);
  if(auto&&auto!==m.status){const antes=m.status;m.status=auto;return {antes,depois:auto};}
  return null;
}
export function statusPill(st){
  const cls=st==='Concluída'?'green':st==='Em andamento'?'amber':'gray';
  return `<span class="pill ${cls}">${h(st)}</span>`;
}
export function aulasDaMateria(id){
  return store.aulas.filter(a=>a.materia===id)
    .sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR',{numeric:true,sensitivity:'base'}));
}
export function nowHM(){const d=new Date(),p=n=>String(n).padStart(2,'0');return p(d.getHours())+':'+p(d.getMinutes());}
export function hmToMin(s){if(!s)return null;const[a,b]=s.split(':').map(Number);return a*60+b;}
export function safeUrl(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?u:'';}

export let _uniPeriodo=null;
export function setUniPeriodo(v){_uniPeriodo=v;vUnitins();}
/* Recorte do Hub: matérias pertencem a um período; aulas, síncronas e entregáveis
   herdam o período pela matéria — não precisam de campo próprio. */
export function uniPidSel(){
  if(_uniPeriodo==='all')return 'all';
  if(!_uniPeriodo||!periodoById(_uniPeriodo)) _uniPeriodo=(periodoAtivo()||{}).id||'all';
  return _uniPeriodo;
}
export function materiasDoPeriodo(){
  const pid=uniPidSel();
  return pid==='all'?store.materias:store.materias.filter(m=>m.periodo===pid);
}
export function matIdsPeriodo(){return new Set(materiasDoPeriodo().map(m=>m.id));}
export function noPeriodo(x){return uniPidSel()==='all'||matIdsPeriodo().has(x.materia);}
export function vUnitins(){
  window._uniTab=window._uniTab||'materias';
  const t=window._uniTab;
  const pid=uniPidSel(), pSel=pid==='all'?null:periodoById(pid);
  const tab=(id,nm)=>`<button class="area-tab ${t===id?'active':''}" onclick="setUni('${id}')">${nm}</button>`;
  const nSinc=store.sincronas.filter(s=>s.data>=todayISO()&&noPeriodo(s)).length;
  const entPer=store.entregaveis.filter(noPeriodo);
  const nEntAb=entPer.filter(e=>e.status!=='Entregue').length;
  const nEntAtr=entPer.filter(e=>entregState(e)==='atrasado').length;
  let body='';
  if(t==='materias')       body=uniMaterias();
  else if(t==='aulas')     body=uniAulas();
  else if(t==='sincronas') body=uniSincronas();
  else if(t==='diario')    body=uniDiario();
  else                     body=uniEntregaveis();
  document.getElementById('view').innerHTML=`
    <div class="page-title">hub unitins</div>
    <div class="page-sub">Aulas gravadas agrupadas por matéria, aulas síncronas com data e hora (avisam no Dashboard no dia), entregáveis com prazo e o diário de bordo da área. O status da matéria se atualiza sozinho conforme você marca as aulas.</div>
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="field" style="margin:0;flex:1;min-width:200px">
          <label>Período letivo</label>
          <select onchange="setUniPeriodo(this.value)">
            ${store.periodos.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${h(periodoLabel(p))}${p.id===((periodoAtivo()||{}).id)?' · vigente':''}</option>`).join('')}
            <option value="all" ${pid==='all'?'selected':''}>Todos os períodos</option>
          </select>
        </div>
        ${pSel&&periodoEncerrado(pSel)?'<span class="pill gray">encerrado</span>':''}
        <span class="pill purple">${materiasDoPeriodo().length} matérias</span>
        <button class="btn sm line" onclick="mPeriodos()">Gerenciar</button>
      </div>
    </div>
    <div class="area-tabs">${tab('materias','Matérias')}${tab('aulas','Aulas gravadas')}${tab('sincronas','Aulas síncronas'+(nSinc?` · ${nSinc}`:''))}${tab('entregaveis','Entregáveis'+(nEntAtr?` · ⚠ ${nEntAtr}`:(nEntAb?` · ${nEntAb}`:'')))}${tab('diario','Diário de bordo')}</div>
    ${body}`;
}
export function setUni(t){window._uniTab=t;vUnitins();}
export function materiaNome(id){const m=store.materias.find(x=>x.id===id);return m?m.nome:'—';}
export function materiaOptions(sel){
  const mats=materiasDoPeriodo();
  const lista=(sel&&!mats.some(m=>m.id===sel))?[...mats,...store.materias.filter(m=>m.id===sel)]:mats;
  return lista.map(m=>`<option value="${m.id}" ${m.id===sel?'selected':''}>${h(m.nome)}</option>`).join('');}

/* ---- Aba: Matérias ---- */
/* Barra compacta da célula de progresso. Três leituras diferentes (assistir,
   estudar, entregar) só se comparam de relance se tiverem a MESMA forma —
   por isso uma função só, e não três blocos de HTML parecidos. */
export function miniBarra(icone,feito,total,cor,tip){
  const pct=total?Math.round(feito/total*100):0;
  return `<div style="display:flex;align-items:center;gap:8px" title="${h(tip||'')}">
    <div class="bar-track" style="height:7px;flex:1"><i style="width:${pct}%;background:${cor}"></i></div>
    <span style="font-size:11px;color:var(--muted);white-space:nowrap">${icone} ${feito}/${total}</span></div>`;
}
export function uniMaterias(){
  const mats=materiasDoPeriodo();
  if(!mats.length)
    return `<button class="btn sm" style="margin-bottom:14px" onclick="mMateria()">+ Nova matéria</button>
      <div class="card"><div class="empty">Nenhuma matéria neste período.</div></div>`;
  const linhas=mats.map(m=>{
    const aulas=aulasDaMateria(m.id);
    const feitas=aulas.filter(a=>a.done).length;
    const estudadas=aulas.filter(a=>a.estudada).length;
    const ents=entregaveisDaMateria(m.id);
    const entregues=ents.filter(e=>e.status==='Entregue').length;
    const atrasadosM=ents.filter(e=>entregState(e)==='atrasado').length;
    const st=materiaStatus(m);
    const prox=store.entregaveis.filter(e=>e.materia===m.id&&e.prazo&&e.status!=='Entregue')
      .sort((a,b)=>a.prazo.localeCompare(b.prazo))[0];
    const sinc=store.sincronas.filter(s=>s.materia===m.id&&s.data>=todayISO())
      .sort((a,b)=>(a.data+a.ini).localeCompare(b.data+b.ini))[0];
    return `<tr>
      <td><b>${h(m.nome)}</b></td>
      <td style="white-space:nowrap">
        <select class="st-select" onchange="setMateriaStatus('${m.id}',this.value)">
          ${['Não iniciada','Em andamento','Concluída'].map(s=>`<option ${st===s?'selected':''}>${s}</option>`).join('')}
        </select>
        ${m.statusManual
          ? `<button class="icon-btn" onclick="resetMateriaStatus('${m.id}')" title="Travado manualmente — clique para voltar ao automático">🔒</button>`
          : `<span class="icon-btn" title="Automático: segue as aulas marcadas" style="cursor:default">⚙</span>`}
      </td>
      <td style="min-width:190px">${(!aulas.length&&!ents.length)?'<span style="color:var(--faint)">sem aulas</span>':
        `<div style="display:flex;flex-direction:column;gap:4px">
          ${aulas.length?miniBarra('✓',feitas,aulas.length,'var(--purple)','Aulas assistidas'):''}
          ${aulas.length?miniBarra('📖',estudadas,aulas.length,'var(--green)','Aulas estudadas'):''}
          ${ents.length?miniBarra('📌',entregues,ents.length,'var(--blue)',
              `Entregáveis entregues${atrasadosM?` · ${atrasadosM} atrasado(s)`:''}`):''}
          ${atrasadosM?`<span style="font-size:11px;color:var(--red);font-weight:600">⚠ ${atrasadosM} entregável${atrasadosM>1?'is':''} atrasado${atrasadosM>1?'s':''}</span>`:''}
        </div>`}</td>
      <td style="white-space:nowrap">${sinc?`${fmtBR(sinc.data).slice(0,5)} ${sinc.ini||''}`:'—'}</td>
      <td style="white-space:nowrap">${prox?`<span class="pill ${prox.prazo<todayISO()?'red':'gray'}">${prox.prazo<todayISO()?'⚠ ':''}${fmtBR(prox.prazo)}</span>`:'—'}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" onclick="mMateria('${m.id}')" title="Editar">✎</button>
        <button class="icon-btn" onclick="delMateria('${m.id}')" title="Excluir">✕</button></td></tr>`;}).join('');
  return `<button class="btn sm" style="margin-bottom:14px" onclick="mMateria()">+ Nova matéria</button>
    <div class="card" style="padding:6px 20px">
      <div class="table-wrap"><table>
        <thead><tr><th>Matéria</th><th>Status</th><th>Progresso</th><th>Próx. síncrona</th><th>Próximo prazo</th><th></th></tr></thead>
        <tbody>${linhas}</tbody></table></div>
    </div>
    <div class="h-sub" style="margin-top:10px"><b>✓</b> aulas assistidas · <b>📖</b> aulas estudadas · <b>📌</b> entregáveis entregues — a barra 📌 não entra no status: o ⚙ segue só as aulas.<br>
      ⚙ = status automático · 🔒 = fixado por você; clique no cadeado para devolver ao automático.</div>`;
}
export function setMateriaStatus(id,v){
  const m=store.materias.find(x=>x.id===id); if(!m)return;
  const auto=materiaStatusAuto(id);
  m.status=v;
  m.statusManual = !(auto&&auto===v);   // se coincide com o automático, não precisa travar
  save();vUnitins();
  toast(m.statusManual?'Status fixado manualmente 🔒':'Status igual ao automático — segue automático');
}
export function resetMateriaStatus(id){
  const m=store.materias.find(x=>x.id===id); if(!m)return;
  m.statusManual=false; syncMateriaStatus(id);
  save();vUnitins();toast('Voltou ao automático ⚙');
}
export function mMateria(id=null){
  const m=id?store.materias.find(x=>x.id===id):null;
  modal(`<h3>${m?'Editar matéria':'Nova matéria'}</h3>
  <div class="field"><label>Nome</label><input id="mmn" placeholder="Ex: Cálculo I" value="${m?h(m.nome):''}"></div>
  <div class="field"><label>Status inicial</label><select id="mms">
    ${['Não iniciada','Em andamento','Concluída'].map(s=>`<option ${(m?materiaStatus(m):'Não iniciada')===s?'selected':''}>${s}</option>`).join('')}
  </select></div>
  <div class="h-sub" style="margin-top:-4px">O status passa a se atualizar sozinho conforme você marca as aulas gravadas.</div>
  ${m?`<div class="field"><label>Período letivo</label><select id="mmp">
    ${store.periodos.map(p=>`<option value="${p.id}" ${p.id===m.periodo?'selected':''}>${h(periodoLabel(p))}</option>`).join('')}
  </select></div>`:''}
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="saveMateria(${m?`'${id}'`:'null'})">${m?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('mmn').focus(),50);
}
export function saveMateria(id){
  const n=document.getElementById('mmn').value.trim(); if(!n){toast('Dê um nome à matéria');return;}
  const st=document.getElementById('mms').value;
  if(id){const m=store.materias.find(x=>x.id===id);Object.assign(m,{nome:n,status:st});
    const selP=document.getElementById('mmp'); if(selP) m.periodo=selP.value;
    const auto=materiaStatusAuto(id); m.statusManual=!(auto&&auto===st);}
  else{const pid=uniPidSel(); const novo={id:uid(),nome:n,status:st,statusManual:false,
    periodo:pid==='all'?((periodoAtivo()||{}).id||''):pid};store.materias.push(novo);}
  save();closeModal();vUnitins();toast(id?'Matéria atualizada':'Matéria adicionada');
}
export function delMateria(id){
  const m=store.materias.find(x=>x.id===id); if(!m)return;
  const nA=store.aulas.filter(a=>a.materia===id).length,
        nE=store.entregaveis.filter(e=>e.materia===id).length,
        nS=store.sincronas.filter(s=>s.materia===id).length;
  if(!confirm(`Excluir "${m.nome}"?\nTambém serão removidos: ${nA} aulas, ${nS} síncronas e ${nE} entregáveis.`))return;
  store.materias=store.materias.filter(x=>x.id!==id);
  store.aulas=store.aulas.filter(a=>a.materia!==id);
  store.entregaveis=store.entregaveis.filter(e=>e.materia!==id);
  store.sincronas=store.sincronas.filter(s=>s.materia!==id);
  save();vUnitins();toast('Matéria excluída');
}


export function uniDiario(){
  // o diário é por área, não por matéria — o recorte de período vira intervalo de datas
  const pid=uniPidSel(), pS=pid==='all'?null:periodoById(pid);
  DIARIO_ST.unitins.ini=pS?pS.ini:''; DIARIO_ST.unitins.fim=pS?pS.fim:'';
  const noR=l=>!pS||(l.data>=pS.ini&&l.data<=pS.fim);
  const totalUni=countableLogs().filter(l=>l.area==='unitins'&&noR(l)).reduce((s,l)=>s+durH(l.ini,l.fim),0);
  const nSess=store.logs.filter(l=>l.area==='unitins'&&noR(l)).length;
  return `<div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div><h3>Diário de bordo · UNITINS</h3>
          <div class="h-sub" style="margin-bottom:0">As mesmas sessões da página Diários de Bordo, filtradas nesta área${pS?` e no intervalo de <b>${h(pS.nome)}</b>`:''}. Editar aqui edita lá.</div></div>
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill purple">${nSess} ${nSess===1?'sessão':'sessões'}</span>
          <span class="pill green">${fmtDur(totalUni)} acumuladas</span>
        </div>
      </div>
    </div>
    ${diarioPanel('unitins')}`;
}

/* ---- Aba: Entregáveis ----
   Mesma gramática visual das Aulas gravadas: um card por matéria, barra de progresso
   sobre o TOTAL da matéria (nunca sobre o subconjunto filtrado) e marcação direta na
   linha, sem dropdown. A tabela antiga obrigava a ler prazo, status e urgência em três
   colunas para responder uma pergunta só — "isso está de pé ou não?". */
