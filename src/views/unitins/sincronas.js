// views/unitins/sincronas.js — gerado a partir do monólito; edite aqui a partir de agora.
import { periodoAtivo, periodoDe } from '../../core/periodos.js';
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { fmtBR, localISO, todayISO } from '../../core/datas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { renderCurrent } from '../../ui/router.js';
import { mNovaSessao } from '../diario.js';
import { hmToMin, materiaNome, materiaOptions, noPeriodo, nowHM, safeUrl } from './hub.js';

/* ---- Aba: Aulas síncronas ---- */
export function sincStatus(s){
  const hoje=todayISO();
  if(s.data>hoje) return {txt:'agendada',cls:'gray'};
  if(s.data<hoje) return {txt:'realizada',cls:'gray'};
  const agora=hmToMin(nowHM()), ini=hmToMin(s.ini), fim=hmToMin(s.fim)||(ini!=null?ini+60:null);
  if(ini==null) return {txt:'hoje',cls:'blue'};
  if(agora<ini){const d=ini-agora;return {txt:d<=60?`em ${d}min`:`hoje às ${s.ini}`,cls:d<=60?'red':'blue'};}
  if(fim!=null&&agora<=fim) return {txt:'🔴 acontecendo agora',cls:'red'};
  return {txt:'encerrada',cls:'gray'};
}
export function uniSincronas(){
  const hoje=todayISO();
  const prox=store.sincronas.filter(s=>s.data>=hoje&&noPeriodo(s)).sort((a,b)=>(a.data+(a.ini||'')).localeCompare(b.data+(b.ini||'')));
  const pass=store.sincronas.filter(s=>s.data<hoje&&noPeriodo(s)).sort((a,b)=>(b.data+(b.ini||'')).localeCompare(a.data+(a.ini||''))).slice(0,15);
  const linha=s=>{const st=sincStatus(s);const url=safeUrl(s.link);
    return `<tr>
      <td style="white-space:nowrap"><b>${fmtBR(s.data)}</b><div style="font-size:11px;color:var(--faint)">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(s.data+'T12:00').getDay()]}</div></td>
      <td style="white-space:nowrap">${h(s.ini||'—')}${s.fim?'–'+h(s.fim):''}</td>
      <td><b>${h(s.nome)}</b>${s.serie?' <span class="pill gray" title="Faz parte de uma série recorrente">🔁</span>':''}${s.obs?`<div style="font-size:11px;color:var(--faint)">${h(s.obs)}</div>`:''}</td>
      <td>${h(materiaNome(s.materia))}</td>
      <td><span class="pill ${st.cls}">${st.txt}</span></td>
      <td style="white-space:nowrap">
        ${url?`<a class="icon-btn" href="${h(url)}" target="_blank" rel="noopener" title="Abrir link">🔗</a>`:''}
        <button class="icon-btn" onclick="registrarSincrona('${s.id}')" title="Lançar no Diário de Bordo">⏱</button>
        <button class="icon-btn" onclick="mSincrona('${s.id}')" title="Editar">✎</button>
        <button class="icon-btn" onclick="delSincrona('${s.id}')" title="Excluir">✕</button></td></tr>`;};
  const tabela=(rows)=>`<div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Horário</th><th>Aula</th><th>Matéria</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  return `<div style="display:flex;margin-bottom:14px">
      <button class="btn sm" style="margin-left:auto" onclick="mSincrona()">+ Nova aula síncrona</button></div>
    <div class="card" style="padding:6px 20px">
      ${prox.length?tabela(prox.map(linha).join('')):'<div class="empty">Nenhuma aula síncrona agendada.<br>Cadastre a 1ª e deixe a repetição mensal criar o resto até 06/12.</div>'}
    </div>
    ${pass.length?`<div class="card" style="margin-top:16px;padding:6px 20px">
      <div style="padding:14px 0 4px"><h3>Já realizadas</h3><div class="h-sub" style="margin-bottom:0">Últimas 15</div></div>
      ${tabela(pass.map(linha).join(''))}</div>`:''}`;
}
/* --- recorrência: mensal por padrão, mas configurável --- */
export function monthLastDay(y,m){return new Date(y,m+1,0).getDate();}
export function nthWeekdayDate(y,m,weekday,nth){
  const last=monthLastDay(y,m);
  const offset=(weekday-new Date(y,m,1).getDay()+7)%7;
  let day=1+offset+(nth-1)*7;
  if(day>last) day=1+offset+Math.floor((last-1-offset)/7)*7; // não existe a 5ª: usa a última do mês
  return new Date(y,m,day);
}
export function gerarDatasSincrona(baseISO,freq,ateISO){
  if(!baseISO)return [];
  if(freq==='nenhuma'||!ateISO||ateISO<baseISO)return [baseISO];
  const base=new Date(baseISO+'T12:00'), ate=new Date(ateISO+'T12:00'), out=[];
  if(freq==='semanal'||freq==='quinzenal'){
    const step=freq==='semanal'?7:14; const d=new Date(base);
    while(d<=ate&&out.length<80){out.push(localISO(d));d.setDate(d.getDate()+step);}
    return out;
  }
  const wd=base.getDay(), ord=Math.min(5,Math.floor((base.getDate()-1)/7)+1);
  let y=base.getFullYear(), m=base.getMonth();
  while(out.length<80){
    const d = freq==='mensal_semana' ? nthWeekdayDate(y,m,wd,ord)
            : new Date(y,m,Math.min(base.getDate(),monthLastDay(y,m)));
    const iso=localISO(d);
    if(iso>ateISO)break;
    if(iso>=baseISO)out.push(iso);
    m++; if(m>11){m=0;y++;}
  }
  return out;
}
export function freqLabel(freq,baseISO){
  const wdNome=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  const ordNome=['','1ª','2ª','3ª','4ª','5ª'];
  if(freq==='nenhuma')return 'data única';
  if(freq==='semanal')return 'toda semana';
  if(freq==='quinzenal')return 'a cada 15 dias';
  const b=new Date(baseISO+'T12:00');
  if(freq==='mensal_semana')return `toda ${ordNome[Math.min(5,Math.floor((b.getDate()-1)/7)+1)]} ${wdNome[b.getDay()]} do mês`;
  return `todo dia ${b.getDate()} de cada mês`;
}
export function previewSincronas(){
  const box=document.getElementById('syPrev'); if(!box)return;
  const data=document.getElementById('syd').value;
  const freq=document.getElementById('syrep').value;
  const ate=document.getElementById('syr');
  const wrap=document.getElementById('syAteWrap');
  if(wrap)wrap.style.display=freq==='nenhuma'?'none':'block';
  if(!data){box.innerHTML='Informe a data da 1ª aula.';return;}
  const datas=gerarDatasSincrona(data,freq,ate?ate.value:'');
  if(datas.length<=1){box.innerHTML=`Será criada <b>1 aula</b> em ${fmtBR(data)}.`;return;}
  const amostra=datas.slice(0,8).map(d=>fmtBR(d).slice(0,5)).join(' · ');
  box.innerHTML=`Serão criadas <b>${datas.length} aulas</b> (${freqLabel(freq,data)}): ${amostra}${datas.length>8?` … até ${fmtBR(datas[datas.length-1]).slice(0,5)}`:''}`;
}
export function serieFuturas(s){
  if(!s||!s.serie)return [];
  return store.sincronas.filter(x=>x.serie===s.serie&&x.id!==s.id&&x.data>=s.data);
}
export function mSincrona(id=null){
  if(!store.materias.length){toast('Cadastre uma matéria primeiro');return;}
  const s=id?store.sincronas.find(x=>x.id===id):null;
  const fut=s?serieFuturas(s).length:0;
  modal(`<h3>${s?'Editar aula síncrona':'Nova aula síncrona'}</h3>
  <div class="field"><label>Nome / tema da aula</label><input id="syn" placeholder="Ex: Cálculo I — encontro ao vivo" value="${s?h(s.nome):''}"></div>
  <div class="field"><label>Matéria</label><select id="sym">${materiaOptions(s?s.materia:'')}</select></div>
  <div class="field"><label>${s?'Data':'Data da 1ª aula'}</label><input type="date" id="syd" value="${s?s.data:todayISO()}" onchange="previewSincronas()"></div>
  <div class="grid2">
    <div class="field"><label>Início</label><input type="time" id="syi" value="${s?h(s.ini||''):'19:00'}"></div>
    <div class="field"><label>Fim</label><input type="time" id="syf" value="${s?h(s.fim||''):'21:00'}"></div>
  </div>
  <div class="field"><label>Link da sala (opcional)</label><input id="syl" placeholder="https://meet..." value="${s?h(s.link||''):''}"></div>
  <div class="field"><label>Observação (opcional)</label><input id="syo" placeholder="Ex: chamada vale nota" value="${s?h(s.obs||''):''}"></div>
  ${s?(fut?`<div style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px">
      <label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--muted);cursor:pointer">
        <input type="checkbox" id="syAll" style="width:auto"> Aplicar nome, horário, link e observação às <b>${fut}</b> próximas aulas desta série
      </label>
      <div class="h-sub" style="margin-top:6px">A data nunca é propagada — cada encontro mantém a sua.</div></div>`:'')
    :`<div style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px">
      <div class="grid2">
        <div class="field"><label>Repetição</label><select id="syrep" onchange="previewSincronas()">
          <option value="mensal_semana" selected>Mensal — mesma posição na semana (ex: 2ª terça)</option>
          <option value="mensal_dia">Mensal — mesmo dia do mês</option>
          <option value="quinzenal">Quinzenal</option>
          <option value="semanal">Semanal</option>
          <option value="nenhuma">Não repetir (data única)</option>
        </select></div>
        <div class="field" id="syAteWrap"><label>Repetir até</label><input type="date" id="syr" value="${s?(s.repAte||((periodoDe(s.data)||periodoAtivo()||{}).fim||'')):((periodoAtivo()||{}).fim||'')}" onchange="previewSincronas()"></div>
      </div>
      <div class="h-sub" id="syPrev" style="margin-top:-4px"></div>
    </div>`}
  <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
  <button class="btn" onclick="saveSincrona(${s?`'${id}'`:'null'})">${s?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>{const el=document.getElementById('syn');if(el)el.focus();previewSincronas();},50);
}
export function saveSincrona(id){
  const nome=document.getElementById('syn').value.trim();
  const data=document.getElementById('syd').value;
  if(!nome||!data){toast('Preencha nome e data');return;}
  const base={nome,materia:document.getElementById('sym').value,data,
    ini:document.getElementById('syi').value,fim:document.getElementById('syf').value,
    link:safeUrl(document.getElementById('syl').value),obs:document.getElementById('syo').value.trim()};
  if(id){
    const s=store.sincronas.find(x=>x.id===id);
    const all=document.getElementById('syAll')&&document.getElementById('syAll').checked;
    const fut=all?serieFuturas(s):[];
    Object.assign(s,base);
    fut.forEach(f=>Object.assign(f,{nome:base.nome,materia:base.materia,ini:base.ini,fim:base.fim,link:base.link,obs:base.obs}));
    save();closeModal();renderCurrent();
    toast(fut.length?`Atualizada + ${fut.length} da série`:'Aula síncrona atualizada');
    return;
  }
  const freq=document.getElementById('syrep').value;
  const ate=document.getElementById('syr')?document.getElementById('syr').value:'';
  const datas=gerarDatasSincrona(data,freq,ate);
  const serie=datas.length>1?uid():null;
  datas.forEach(d=>store.sincronas.push({id:uid(),...base,data:d,serie}));
  save();closeModal();renderCurrent();
  toast(datas.length>1?`${datas.length} aulas síncronas criadas`:'Aula síncrona adicionada');
}
export function delSincrona(id){
  const s=store.sincronas.find(x=>x.id===id); if(!s)return;
  const fut=serieFuturas(s);
  if(!fut.length){
    store.sincronas=store.sincronas.filter(x=>x.id!==id);save();renderCurrent();toast('Aula removida');return;
  }
  modal(`<h3>Excluir aula da série</h3>
    <div class="h-sub">${h(s.nome)} · ${fmtBR(s.data)}<br>Esta aula faz parte de uma série com mais <b>${fut.length}</b> encontro(s) a partir desta data.</div>
    <div class="modal-actions" style="flex-direction:column">
      <button class="btn" style="width:100%;justify-content:center" onclick="delSincronaConfirm('${id}',false)">Excluir só esta</button>
      <button class="btn" style="width:100%;justify-content:center;background:var(--red)" onclick="delSincronaConfirm('${id}',true)">Excluir esta e as ${fut.length} seguintes</button>
      <button class="btn line" style="width:100%;justify-content:center" onclick="closeModal()">Cancelar</button>
    </div>`);
}
export function delSincronaConfirm(id,todas){
  const s=store.sincronas.find(x=>x.id===id); if(!s)return;
  const ids=new Set([id,...(todas?serieFuturas(s).map(x=>x.id):[])]);
  store.sincronas=store.sincronas.filter(x=>!ids.has(x.id));
  save();closeModal();renderCurrent();toast(ids.size>1?`${ids.size} aulas removidas`:'Aula removida');
}
export function registrarSincrona(id){
  const s=store.sincronas.find(x=>x.id===id); if(!s)return;
  mNovaSessao('unitins',null,{area:'unitins',atividade:s.nome,data:s.data,ini:s.ini||'',fim:s.fim||''});
}
export function sincronasHoje(){
  const t=todayISO();
  return store.sincronas.filter(s=>s.data===t).sort((a,b)=>(a.ini||'').localeCompare(b.ini||''));
}
export function dashSincronasCard(){
  const list=sincronasHoje();
  if(!list.length)return '';
  return `<div class="card" style="margin-bottom:20px;border:1px solid var(--blue);background:var(--blue-soft)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">🎥</span><h3 style="color:var(--blue)">Aula síncrona hoje (${list.length})</h3></div>
    ${list.map(s=>{const st=sincStatus(s);const url=safeUrl(s.link);
      return `<div class="list-item">
        <div class="li-body"><div class="t">${h(s.nome)}</div>
        <div class="m"><span class="pill ${st.cls}">${st.txt}</span>
          <b style="color:var(--ink)">${h(s.ini||'—')}${s.fim?'–'+h(s.fim):''}</b> · ${h(materiaNome(s.materia))}
          ${s.obs?' · '+h(s.obs):''}</div></div>
        ${url?`<a class="btn sm ghost" href="${h(url)}" target="_blank" rel="noopener">Entrar</a>`:''}
        <button class="btn sm line" onclick="registrarSincrona('${s.id}')">Registrar</button>
      </div>`;}).join('')}
  </div>`;
}

/* ---- Aba: Diário de bordo (mesma engine da página "Diários de Bordo") ---- */
