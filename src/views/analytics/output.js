// views/analytics/output.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, areaById } from '../../core/constantes.js';
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { durH, fmtBR, fmtDur, todayISO } from '../../core/datas.js';
import { countableLogs } from '../../core/horas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { renderCurrent } from '../../ui/router.js';
import { addDaysISO, anoAncora, anoAtual } from './graficos.js';
import { mesLabel } from '../habitos/estante.js';

/* ======================================================================
   OUTPUT: produção x consumo e nível por idioma
   Horas medem esforço, não aprendizado. Dois sinais complementares:
   • % de produção ativa por área (falar/escrever/resolver) — derivado dos logs.
   • Nível CEFR por idioma, 1 check-in por mês, com fonte (autoavaliação ou teste)
     e evidência concreta para a autoavaliação não virar palpite.
   ====================================================================== */
export const NIVEIS=['A1','A1+','A2','A2+','B1','B1+','B2','B2+','C1','C1+','C2'];
export const NIVEL_DESC={A1:'Frases feitas e apresentações básicas.',A2:'Tarefas rotineiras; frases simples sobre si e o entorno.',
  B1:'Se vira em viagem; conta experiências e justifica opiniões com frases ligadas.',
  B2:'Conversa com nativo sem esforço dos dois lados; texto claro e detalhado sobre temas variados.',
  C1:'Expressão fluente e espontânea; uso flexível em contexto acadêmico e profissional.',C2:'Entende praticamente tudo; nuance fina.'};
export const idiomas=()=>AREAS.filter(a=>a.idioma);
export function checkinsDe(area){ return store.checkins.filter(c=>c.area===area).sort((a,b)=>a.mes.localeCompare(b.mes)); }
export function mCheckin(area,editId){
  const ed=editId?store.checkins.find(c=>c.id===editId):null;
  const ar=ed?ed.area:(area||idiomas()[0].id), mes=ed?ed.mes:todayISO().slice(0,7);
  const ult=checkinsDe(ar).slice(-1)[0];
  const nv=ed?ed.nivel:(ult?ult.nivel:'B1');
  modal(`<h3>${ed?'Editar nível':'Check-in de nível'}</h3>
    <div class="grid2">
      <div class="field"><label>Idioma</label><select id="ckA">${idiomas().map(a=>`<option value="${a.id}" ${a.id===ar?'selected':''}>${a.nome}</option>`).join('')}</select></div>
      <div class="field"><label>Mês</label><input type="month" id="ckM" value="${mes}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Nível</label><select id="ckN" onchange="ckDesc()">${NIVEIS.map(n=>`<option ${n===nv?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Fonte</label><select id="ckF"><option value="auto" ${!ed||ed.fonte!=='teste'?'selected':''}>Autoavaliação</option>
        <option value="teste" ${ed&&ed.fonte==='teste'?'selected':''}>Teste (EF SET, Busuu, etc.)</option></select></div>
    </div>
    <div id="ckDesc" style="font-size:12px;color:var(--muted);margin:-4px 0 12px;line-height:1.45"></div>
    <div class="field"><label>Evidência</label><input id="ckO" placeholder="Ex.: entendi um episódio da BBC sem legenda" value="${ed?h(ed.obs||''):''}"></div>
    <div style="font-size:11px;color:var(--faint);margin-top:-4px">Sem evidência concreta, a autoavaliação tende a subir por inércia. "+" = acima do meio do nível.</div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="saveCheckin(${ed?`'${ed.id}'`:'null'})">Salvar</button></div>`);
  ckDesc();
}
export function ckDesc(){ const n=document.getElementById('ckN').value; const el=document.getElementById('ckDesc');
  if(el) el.textContent=(NIVEL_DESC[n.replace('+','')]||'')+(n.endsWith('+')?' Já com parte do nível seguinte.':''); }
export function saveCheckin(editId){
  const area=document.getElementById('ckA').value, mes=document.getElementById('ckM').value;
  if(!/^\d{4}-\d{2}$/.test(mes)){toast('Informe o mês');return;}
  const dados={area,mes,nivel:document.getElementById('ckN').value,fonte:document.getElementById('ckF').value,obs:document.getElementById('ckO').value.trim()};
  // 1 por idioma por mês: salvar num mês ocupado substitui o registro existente
  const outro=store.checkins.find(c=>c.area===area&&c.mes===mes&&c.id!==editId);
  if(outro&&!confirm(`Já existe ${outro.nivel} em ${mes} para ${areaById(area).nome}. Substituir?`))return;
  if(outro) store.checkins=store.checkins.filter(c=>c.id!==outro.id);
  if(editId) Object.assign(store.checkins.find(c=>c.id===editId),dados);
  else store.checkins.push({id:uid(),...dados});
  save(); closeModal(); renderCurrent(); toast('Nível registrado');
}
export function delCheckin(id){ if(!confirm('Excluir este check-in?'))return; store.checkins=store.checkins.filter(c=>c.id!==id); save(); renderCurrent(); }

export function saidaRange(ini,fim){
  const m={}; countableLogs().forEach(l=>{ if(l.data<ini||l.data>fim)return;
    const x=m[l.area]=m[l.area]||{tot:0,out:0}; const d=durH(l.ini,l.fim); x.tot+=d; if(l.saida)x.out+=d; });
  return m;
}
export function cardSaida(y){
  const anc=anoAncora(y), ini=addDaysISO(anc,-27), iniA=addDaysISO(anc,-55), fimA=addDaysISO(anc,-28);
  const cur=saidaRange(ini,anc), ant=saidaRange(iniA,fimA);
  const linhas=AREAS.filter(a=>a.conta&&cur[a.id]&&cur[a.id].tot>0).map(a=>{
    const c=cur[a.id], pc=c.out/c.tot*100, p=ant[a.id], pa=p&&p.tot>0?p.out/p.tot*100:null;
    const dpp=pa==null?null:Math.round(pc-pa);
    return `<div class="out-row">
      <span><span class="tag-dot" style="background:${a.cor};margin-right:7px"></span><b>${a.nome}</b></span>
      <div class="out-bar" title="${fmtDur(c.out)} produção · ${fmtDur(c.tot-c.out)} consumo"><i style="width:${pc}%;background:${a.cor}"></i><i style="width:${100-pc}%;background:${a.cor};opacity:.22"></i></div>
      <div class="out-num"><b>${Math.round(pc)}%</b><small>${fmtDur(c.out)}</small></div>
      <div class="out-num">${dpp==null?'<span class="ar new">novo</span>':dpp===0?'<span class="ar flat">=</span>'
        :`<span class="ar ${dpp>0?'up':'down'}" title="pontos percentuais vs. 28 dias anteriores">${dpp>0?'▲':'▼'} ${Math.abs(dpp)} pp</span>`}</div></div>`;}).join('');
  const baixos=idiomas().filter(a=>cur[a.id]&&cur[a.id].tot>=2&&cur[a.id].out/cur[a.id].tot<0.2);
  const mesAtual=todayISO().slice(0,7), ehAtual=y===anoAtual();
  const meses=Array.from({length:12},(_,i)=>y+'-'+String(i+1).padStart(2,'0'));
  const mAbbr=['j','f','m','a','m','j','j','a','s','o','n','d'];
  const cards=idiomas().map(a=>{
    const cks=checkinsDe(a.id), doAno=cks.filter(c=>c.mes.startsWith(String(y))), ult=cks.slice(-1)[0];
    const prim=doAno[0], ultAno=doAno.slice(-1)[0];
    const passos=prim&&ultAno?NIVEIS.indexOf(ultAno.nivel)-NIVEIS.indexOf(prim.nivel):0;
    const pend=ehAtual&&!cks.some(c=>c.mes===mesAtual);
    const porMes={}; doAno.forEach(c=>porMes[c.mes]=c);
    return `<div class="lv-card">
      <div class="lv-top"><span class="tag-dot" style="background:${a.cor}"></span><span style="font-size:13px;font-weight:600">${a.nome}</span>
        <b style="margin-left:auto">${ult?h(ult.nivel):'—'}</b></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px">
        ${ult?`<span class="pill ${ult.fonte==='teste'?'blue':'gray'}">${ult.fonte==='teste'?'teste':'autoavaliação'} · ${h(mesLabel(ult.mes))}</span>`:''}
        ${doAno.length>1?`<span class="pill ${passos>0?'green':passos<0?'red':'gray'}">${passos>0?'+':''}${passos} ${Math.abs(passos)===1?'subnível':'subníveis'} em ${y}</span>`:''}
        ${pend?`<span class="pill amber">check-in de ${h(mesLabel(mesAtual))} pendente</span>`:''}
      </div>
      <div class="lv-steps">${meses.map(m=>{const c=porMes[m];const i=c?NIVEIS.indexOf(c.nivel):-1;
        return `<span style="height:${c?Math.max(10,(i+1)/NIVEIS.length*100):0}%;background:${c?a.cor:'transparent'};${c&&c.fonte!=='teste'?'opacity:.6':''}"
          title="${c?h(m+': '+c.nivel+(c.obs?' — '+c.obs:'')):m+': sem registro'}"></span>`;}).join('')}</div>
      <div class="lv-meses">${meses.map((m,i)=>`<span style="${m===mesAtual?'color:var(--purple);font-weight:700':''}">${mAbbr[i]}</span>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm ${pend?'':'line'}" onclick="mCheckin('${a.id}')">${pend?'Registrar nível':'+ Check-in'}</button>
        ${ult?`<button class="btn sm line" onclick="mCheckin(null,'${ult.id}')">Editar último</button>
        <button class="icon-btn" title="Excluir último" onclick="delCheckin('${ult.id}')">✕</button>`:''}
      </div></div>`;}).join('');
  return `<div class="card" style="margin-bottom:18px">
    <h3>Produção × consumo</h3>
    <div class="h-sub">Últimos 28 dias até ${fmtBR(anc).slice(0,5)}. Parte cheia = produção ativa (falar, escrever, resolver); clara = consumo. Variação em pontos percentuais vs. os 28 dias anteriores.</div>
    ${linhas||'<div class="empty" style="padding:16px">Sem sessões nesta janela.</div>'}
    ${baixos.length?`<div class="ha-plan" style="color:var(--amber)">${baixos.map(a=>`<b>${a.nome}</b>: ${Math.round(cur[a.id].out/cur[a.id].tot*100)}% de produção`).join(' · ')}
      <small>Abaixo de 20%, as horas são majoritariamente compreensão passiva. Nível de fala raramente sobe sem tempo de fala.</small></div>`:''}
    <h3 style="margin-top:20px">Nível por idioma</h3>
    <div class="h-sub">1 check-in por mês. Barras cheias = teste; translúcidas = autoavaliação.</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">${cards}</div>
  </div>`;
}
