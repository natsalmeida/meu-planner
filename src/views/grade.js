// views/grade.js — gerado a partir do monólito; edite aqui a partir de agora.
import { AREAS, DIAS, areaById } from '../core/constantes.js';
import { periodoAtivo, periodoById, periodoDe, periodoEncerrado, periodoLabel } from '../core/periodos.js';
import { isPlainObj, store } from '../core/store.js';
import { save } from '../core/sync.js';
import { uid } from '../core/app.js';
import { durH, durMin, fmtBR, fmtDur, localISO, todayISO } from '../core/datas.js';
import { countableLogs } from '../core/horas.js';
import { logAlertaHTML, mostrarAlertaLog, validarLog } from '../features/validacao.js';
import { areaOptions, closeModal, h, modal, toast } from '../ui/base.js';
import { renderCurrent } from '../ui/router.js';
import { mNovaSessao } from './diario.js';
import { hmToMin } from './unitins/hub.js';
import { addDaysISO, anMonday } from './analytics/graficos.js';

export let _vgPeriodo=null;
export function setVgPeriodo(id){_vgPeriodo=id;vGrade();}
export function vGrade(){
  _gaCache=null;
  const pAtv=periodoAtivo();
  if(!_vgPeriodo||!periodoById(_vgPeriodo)) _vgPeriodo=pAtv?pAtv.id:'';
  const pSel=periodoById(_vgPeriodo);
  const ehAtivo=!!(pAtv&&pSel&&pSel.id===pAtv.id);
  const blocosSel=gradeDoPeriodo(_vgPeriodo);
  const st=gradeWeekStats();
  const hoje=todayISO();
  const rColor=st.pctAte>=70?'var(--green)':st.pctAte>=40?'var(--amber)':'var(--rose)';
  const barrasArea=st.areas.length? st.areas.map(a=>{
    const pct=a.plan?Math.min(100,Math.round(a.feito/a.plan*100)):0;
    const ok=a.feito>=a.plan;
    return `<div class="bar-row"><div class="lbl">${areaById(a.id).nome}</div>
      <div class="bar-track"><i style="width:${pct}%;background:${ok?'var(--green)':areaById(a.id).cor}"></i></div>
      <div class="val" style="width:110px">${fmtDur(a.feito/60)}/${fmtDur(a.plan/60)}</div></div>`;}).join('')
    : '<div class="empty" style="padding:14px">Sem blocos de estudo na grade.</div>';
  document.getElementById('view').innerHTML=`
    <div class="page-title">grade semanal</div>
    <div class="page-sub">Sua rotina planejada, <b>versionada por período letivo</b>: a aderência de uma semana passada é sempre comparada com a grade que valia naquela semana. Trocar de semestre não reescreve o histórico. O saldo compensa entre os dias — estudar Espanhol no sábado cobre o bloco de segunda.</div>
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="field" style="margin:0;flex:1;min-width:200px">
          <label>Período letivo</label>
          <select onchange="setVgPeriodo(this.value)">
            ${store.periodos.map(p=>`<option value="${p.id}" ${p.id===_vgPeriodo?'selected':''}>${h(periodoLabel(p))}${p.id===(pAtv&&pAtv.id)?' · vigente':''}</option>`).join('')}
          </select>
        </div>
        <span class="pill ${ehAtivo?'green':'gray'}">${blocosSel.length} blocos</span>
        ${!blocosSel.length&&store.periodos.length>1?`<button class="btn sm line" onclick="mCopiarGrade()">Copiar de outro período</button>`:''}
        <button class="btn sm line" onclick="mPeriodos()">Gerenciar períodos</button>
      </div>
    </div>
    ${!ehAtivo?`<div class="card" style="margin-bottom:16px;border:1px solid var(--line);background:var(--card-2)">
      <div style="font-size:13px;color:var(--muted)">Você está vendo a grade de <b>${h(pSel?pSel.nome:'—')}</b>${periodoEncerrado(pSel)?' (encerrado)':' (ainda não começou)'}. A aderência só é calculada para a semana corrente, então ela não aparece aqui — mas os blocos continuam editáveis, útil para montar o próximo semestre com antecedência.</div>
    </div>`:''}
    ${!ehAtivo?'':`<div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><h3>Aderência da semana</h3><div class="h-sub" style="margin-bottom:0">Tempo estudado ÷ planejado, por área, na semana inteira (Seg–Dom) · TRE fora</div></div>
        <span style="font-family:var(--serif);font-size:30px;font-weight:600;color:var(--purple)">${st.pct}%</span>
      </div>
      <div class="progress" style="height:10px"><i style="width:${st.pct}%;background:linear-gradient(90deg,var(--purple),var(--rose))"></i></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px">
        <div class="h-sub" style="margin:0">${fmtDur(st.feitoCap/60)} de ${fmtDur(st.plan/60)} planejadas · ${st.blocosDone}/${st.blocosTotal} blocos cobertos${st.blocosAdiant?` (${st.blocosAdiant} adiantados)`:''}${st.excedente>0?` · <span style="color:var(--green)">+${fmtDur(st.excedente/60)} além do plano</span>`:''}</div>
        <span class="pill" style="background:${rColor}22;color:${rColor}">No ritmo até hoje: ${st.pctAte}%</span>
      </div>
      <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px">
        <div class="h-sub" style="margin-bottom:10px">Por área — estudado vs. planejado nesta semana</div>
        <div class="bars">${barrasArea}</div>
      </div>
    </div>`}
    <div style="display:flex;margin-bottom:16px"><button class="btn sm" style="margin-left:auto" onclick="mBloco()">+ Novo bloco</button></div>
    ${DIAS.map(d=>{const blocos=blocosSel.filter(g=>g.dia===d).sort((a,b)=>gradeStartMin(a.horario)-gradeStartMin(b.horario));
      const di=DIAS.indexOf(d); const mon=anMonday(0); const dd=new Date(mon); dd.setDate(dd.getDate()+di); const dISO=localISO(dd);
      const isHoje=dISO===hoje, isPast=dISO<hoje;
      const alloc=dayAlloc(dISO);
      return `<div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3>${d} ${isHoje?'<span class="pill purple" style="font-size:10px">hoje</span>':''}</h3>
          <button class="btn sm line" onclick="mBloco(null,'${d}')">+ Adicionar em ${d}</button></div>
        ${blocos.length?blocos.map(g=>{const conta=areaById(g.area).conta;const a=alloc[g.id];
          let acao='<span class="pill gray">não conta</span>';
          if(conta){
            if(a&&a.done) acao=a.adiantado
              ?`<span class="pill blue" title="Coberto pelo saldo da semana antes do dia chegar">✓ adiantado</span>`
              :`<span class="pill green" title="${fmtDur(a.alloc/60)} do saldo da área alocados neste bloco">✓ feito</span>`;
            else if(a&&a.alloc>0) acao=`<span class="pill amber" title="Cobertura parcial desta área neste dia">${Math.round(a.alloc/a.need*100)}% · ${fmtDur(a.alloc/60)}</span>`
              +((isHoje||isPast)?` <button class="btn sm line" onclick="cumprirBloco('${g.id}','${dISO}')" title="Completar lançando o bloco cheio">Registrar</button>`:'');
            else if(isHoje) acao=`<button class="btn sm line" onclick="cumprirBloco('${g.id}','${dISO}')">Registrar hoje</button>`;
            else if(isPast) acao=`<button class="btn sm line" onclick="cumprirBloco('${g.id}','${dISO}')" title="Registrar em ${fmtBR(dISO)}">Registrar (${fmtBR(dISO).slice(0,5)})</button>`;
            else acao='<span class="pill gray">a fazer</span>';
          }
          return `<div class="list-item">
          <span class="tag-dot" style="background:${blocoCor(g)}"></span>
          <div class="li-body"><div class="t">${h(g.atividade)}${g.saida?' <span class="pill rose" style="font-size:10px" title="Produção ativa">produção</span>':''}</div><div class="m">${h(g.horario)} · ${h(blocoAreaLbl(g))}${a?` · ${fmtDur(a.need/60)} planejados`:''}</div></div>
          ${acao}
          <button class="icon-btn" onclick="mBloco('${g.id}')" title="Editar">✎</button>
          <button class="icon-btn" onclick="delBloco('${g.id}')" title="Excluir">✕</button>
        </div>`;}).join(''):'<div class="empty" style="padding:16px">Sem blocos neste dia.</div>'}
      </div>`;}).join('')}
    <div class="h-sub">O saldo de cada área na semana paga os blocos em ordem cronológica: primeiro os de dias passados e de hoje, depois os futuros (marcados <span class="pill blue" style="font-size:10px">✓ adiantado</span>). Um bloco fecha com <b>80%</b> da duração planejada coberta.</div>`;
}
export function gradeStartMin(hor){const m=String(hor).match(/(\d{1,2})h(\d{0,2})/);if(!m)return 9999;return parseInt(m[1])*60+(m[2]?parseInt(m[2]):0);}
export function parseGradeTime(hor){
  const m=String(hor).match(/(\d{1,2})h(\d{0,2})\s*[-–]\s*(\d{1,2})h(\d{0,2})/);
  if(!m)return null;
  const p=(hh,mm)=>String(hh).padStart(2,'0')+':'+String(mm||'00').padStart(2,'0');
  return {ini:p(m[1],m[2]), fim:p(m[3],m[4])};
}
export function gradeBlockMin(g){const t=parseGradeTime(g.horario);return t?durMin(t.ini,t.fim):60;}
/* Partes de um bloco por área. Sem split (ou split inválido) = a área do bloco inteira.
   O arredondamento joga o resto na última parte para a soma bater com a duração. */
export function blocoPartes(g){
  const min=gradeBlockMin(g);
  const sp=isPlainObj(g.split)?Object.entries(g.split).filter(([a,p])=>areaById(a).conta&&+p>0):[];
  if(sp.length<2) return [{area:g.area,min,pct:100}];
  const tot=sp.reduce((s,[,p])=>s+(+p),0); let acc=0;
  return sp.map(([a,p],i)=>{const m=i===sp.length-1?min-acc:Math.round(min*(+p)/tot); acc+=m;
    return {area:a,min:m,pct:Math.round(+p/tot*100)};});
}
export function blocoAreaLbl(g){
  const ps=blocoPartes(g);
  return ps.length>1?ps.map(p=>areaById(p.area).nome+' '+p.pct+'%').join(' · '):areaById(g.area).nome;
}
export function blocoCor(g){
  const ps=blocoPartes(g);
  return ps.length>1?`linear-gradient(90deg,${ps.map((p,i)=>`${areaById(p.area).cor} ${i/ps.length*100}% ${(i+1)/ps.length*100}%`).join(',')})`:areaById(g.area).cor;
}

/* ---- Plano previsto por área num intervalo ----
   Percorre dia a dia porque a grade é versionada por período: 11/07→06/12 pode ter
   uma grade e o período seguinte outra, e comparar a aderência de agosto contra a
   grade de dezembro daria um número falso. Dia fora de qualquer período não gera
   plano — assim janeiro a julho de 2026 não entra como "não cumprido".
   Retorna minutos por área + a janela realmente coberta, para o texto não mentir
   sobre o recorte. */
export function planoPorAreaRange(iniISO,fimISO){
  const tabela={}, out={}; let dias=0, de=null, ate=null;
  for(let iso=iniISO; iso<=fimISO; iso=addDaysISO(iso,1)){
    const p=periodoDe(iso); if(!p)continue;
    if(!tabela[p.id]){
      const t=[{},{},{},{},{},{},{}];
      gradeDoPeriodo(p.id).forEach(g=>{
        if(!areaById(g.area).conta)return;                    // TRE nunca vira plano de estudo
        const di=DIAS.indexOf(g.dia); if(di<0)return;
        blocoPartes(g).forEach(pt=>{ t[di][pt.area]=(t[di][pt.area]||0)+pt.min; });
      });
      tabela[p.id]=t;
    }
    const di=(new Date(iso+'T12:00').getDay()+6)%7;            // DIAS começa na segunda
    const m=tabela[p.id][di];
    dias++; if(!de)de=iso; ate=iso;
    Object.keys(m).forEach(a=>{out[a]=(out[a]||0)+m[a];});
  }
  const totalMin=Object.values(out).reduce((a,b)=>a+b,0);
  return {min:out, totalH:totalMin/60, dias, de, ate};
}

/* Alocação semanal: os minutos registrados na semana viram um "saldo" por área e
   pagam os blocos daquela área na ordem cronológica da semana — dia nenhum fica preso
   ao seu próprio registro. Blocos passados/hoje são pagos primeiro; a sobra adianta os futuros. */
export let _gaCache=null;
/* A grade é versionada por período: a aderência de uma semana antiga precisa ser
   comparada com a grade que valia NAQUELA semana, não com a grade de hoje. */
export function gradeDoPeriodo(pid){return store.grade.filter(g=>g.periodo===pid);}
export function gradeDaSemana(monISO){
  const p=periodoDe(monISO)||periodoDe(addDaysISO(monISO,6))||periodoAtivo();
  return p?gradeDoPeriodo(p.id):[];
}
export function weekAlloc(){
  if(_gaCache)return _gaCache;
  const mon=anMonday(0), hoje=todayISO();
  const dias=[];for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(d.getDate()+i);dias.push(localISO(d));}
  const pool={};
  countableLogs().forEach(l=>{if(l.data<dias[0]||l.data>dias[6])return;
    pool[l.area]=(pool[l.area]||0)+durMin(l.ini,l.fim);});
  const blocos=gradeDaSemana(localISO(mon)).filter(g=>areaById(g.area).conta&&DIAS.indexOf(g.dia)>=0)
    .map(g=>({g,di:DIAS.indexOf(g.dia),iso:dias[DIAS.indexOf(g.dia)],ini:gradeStartMin(g.horario)}));
  const cmp=(a,b)=>(a.di-b.di)||(a.ini-b.ini);
  const ordem=[...blocos.filter(b=>b.iso<=hoje).sort(cmp),...blocos.filter(b=>b.iso>hoje).sort(cmp)];
  const res={};
  ordem.forEach(b=>{
    const need=gradeBlockMin(b.g)||1, partes=blocoPartes(b.g); let al=0;
    // 1º cada área paga a própria cota; 2º (só em bloco dividido) a sobra de qualquer área
    // do bloco cobre o resto — Poliglota 100% em inglês continua sendo bloco cumprido.
    partes.forEach(pt=>{ const x=Math.min(pt.min,pool[pt.area]||0); pool[pt.area]=(pool[pt.area]||0)-x; al+=x; });
    if(partes.length>1) partes.forEach(pt=>{ if(al>=need)return; const x=Math.min(need-al,pool[pt.area]||0); pool[pt.area]=(pool[pt.area]||0)-x; al+=x; });
    res[b.g.id]={need,alloc:al,done:al>=need*0.8,adiantado:b.iso>hoje&&al>=need*0.8,iso:b.iso};
  });
  _gaCache={res,sobra:pool};
  return _gaCache;
}
export function dayAlloc(iso){
  const all=weekAlloc().res, out={};
  Object.keys(all).forEach(k=>{if(all[k].iso===iso)out[k]=all[k];});
  return out;
}
export function gradeFulfilledOn(g,iso){const a=dayAlloc(iso)[g.id];return !!(a&&a.done);}
export function gradeWeekStats(){
  _gaCache=null;
  const mon=anMonday(0), hoje=todayISO();
  const dias=[];for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(d.getDate()+i);dias.push(localISO(d));}
  const plan={},planAte={},feito={},feitoAte={};
  gradeDaSemana(dias[0]).forEach(g=>{
    if(!areaById(g.area).conta)return;
    const di=DIAS.indexOf(g.dia); if(di<0)return;
    blocoPartes(g).forEach(pt=>{
      plan[pt.area]=(plan[pt.area]||0)+pt.min;
      if(dias[di]<=hoje) planAte[pt.area]=(planAte[pt.area]||0)+pt.min;
    });
  });
  countableLogs().forEach(l=>{
    if(l.data<dias[0]||l.data>dias[6])return;
    const m=durMin(l.ini,l.fim);
    feito[l.area]=(feito[l.area]||0)+m;
    if(l.data<=hoje) feitoAte[l.area]=(feitoAte[l.area]||0)+m;
  });
  const areas=Object.keys(plan).map(id=>({id,plan:plan[id],feito:feito[id]||0}))
    .sort((a,b)=>b.plan-a.plan);
  const somaPlan=areas.reduce((s,a)=>s+a.plan,0);
  const cap=areas.reduce((s,a)=>s+Math.min(a.plan,a.feito),0);
  const feitoTotal=areas.reduce((s,a)=>s+a.feito,0);
  const somaPlanAte=Object.values(planAte).reduce((s,v)=>s+v,0);
  const capAte=Object.keys(planAte).reduce((s,id)=>s+Math.min(planAte[id],feitoAte[id]||0),0);
  const wa=weekAlloc().res;
  const chaves=Object.keys(wa);
  const blocosTotal=chaves.length;
  const blocosDone=chaves.filter(k=>wa[k].done).length;
  const blocosAdiant=chaves.filter(k=>wa[k].adiantado).length;
  return {areas,plan:somaPlan,feitoCap:cap,excedente:Math.max(0,feitoTotal-cap),
    pct: somaPlan?Math.round(cap/somaPlan*100):0,
    pctAte: somaPlanAte?Math.round(capAte/somaPlanAte*100):0,
    blocosDone,blocosTotal,blocosAdiant};
}
export function cumprirBloco(id,iso){
  const g=store.grade.find(x=>x.id===id); if(!g)return;
  iso=iso||todayISO();
  if(iso>todayISO()){toast('Esse dia ainda não chegou');return;}
  _gaCache=null;
  if(gradeFulfilledOn(g,iso)){toast('Este bloco já está coberto pelo Diário desse dia');return;}
  const t=parseGradeTime(g.horario);
  if(blocoPartes(g).length>1){ mCumprirSplit(id,iso); return; }
  if(!t){ regFromGrade(id); return; }
  const novo={area:g.area,atividade:g.atividade,data:iso,ini:t.ini,fim:t.fim,obs:'',saida:!!g.saida};
  const r=validarLog(novo);
  if(r.bloq.length||r.avisos.length){ mNovaSessao(g.area,null,novo); mostrarAlertaLog(r,null); return; }
  store.logs.push({id:uid(),...novo});
  save(); _gaCache=null; vGrade();
  toast('✓ Registrado em '+fmtBR(iso)+' ('+fmtDur(durH(t.ini,t.fim))+')');
}
export function regFromGrade(id){
  const g=store.grade.find(x=>x.id===id); if(!g)return;
  if(blocoPartes(g).length>1){ mCumprirSplit(id,todayISO()); return; }
  const t=parseGradeTime(g.horario);
  mNovaSessao(g.area,null,{area:g.area,atividade:g.atividade,data:todayISO(),ini:t?t.ini:'',fim:t?t.fim:'',saida:!!g.saida});
}
/* Registro de bloco dividido. A cota da grade é só a estimativa: aqui entra a
   distribuição REAL, que vira sessões contíguas de área única. Assim o log continua
   com uma área só e nenhuma agregação do app precisou mudar. */
export function mCumprirSplit(id,iso){
  const g=store.grade.find(x=>x.id===id); if(!g)return;
  const t=parseGradeTime(g.horario)||{ini:'',fim:''}, ps=blocoPartes(g);
  modal(`<h3>Registrar ${h(g.atividade)}</h3>
    <div class="h-sub" style="margin-top:-10px">${fmtBR(iso)} · planejado: ${h(blocoAreaLbl(g))}</div>
    <div class="grid2">
      <div class="field"><label>Início</label><input type="time" id="ssi" value="${t.ini}" oninput="splitRecalc()"></div>
      <div class="field"><label>Fim</label><input type="time" id="ssf" value="${t.fim}" oninput="splitRecalc()"></div>
    </div>
    <div class="field"><label>Quanto foi de cada idioma/área (min)</label>
      ${ps.map((p,i)=>`<div class="split-row"><span><span class="tag-dot" style="background:${areaById(p.area).cor};margin-right:7px"></span>${areaById(p.area).nome}</span>
        <input type="number" min="0" step="5" class="split-min" data-area="${p.area}" data-i="${i}" value="${p.min}" oninput="splitRecalc(${i})"></div>`).join('')}
      <div id="splitInfo" style="font-size:12px;color:var(--faint)"></div></div>
    <label class="chk-line"><input type="checkbox" id="ssaida" ${g.saida?'checked':''}><span>Produção ativa<small>Falou/escreveu durante o encontro.</small></span></label>
    <div id="logAlert"></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" id="splitSalvar" onclick="salvarSplit('${id}','${iso}')">Salvar</button></div>`);
  splitRecalc();
}
/* Mexer numa área ajusta a outra (com 2 partes) para a soma fechar a duração. */
export function splitRecalc(mexido){
  const ini=document.getElementById('ssi').value, fim=document.getElementById('ssf').value;
  const dur=ini&&fim?durMin(ini,fim):0, inps=[...document.querySelectorAll('.split-min')];
  if(mexido!=null&&inps.length===2&&dur){ const o=inps[1-mexido]; o.value=Math.max(0,dur-(+inps[mexido].value||0)); }
  const soma=inps.reduce((s,x)=>s+(+x.value||0),0), info=document.getElementById('splitInfo');
  info.innerHTML=!dur?'Informe início e fim.':soma===dur?`Total ${fmtDur(dur/60)} ✓`
    :`<span style="color:var(--red)">Soma ${soma} min ≠ duração ${dur} min</span>`;
  const box=document.getElementById('logAlert'); if(box)box.innerHTML='';
  const b=document.getElementById('splitSalvar'); if(b){b.textContent='Salvar'; b.dataset.conf='';}
}
export function salvarSplit(id,iso){
  const g=store.grade.find(x=>x.id===id); if(!g)return;
  const ini=document.getElementById('ssi').value, fim=document.getElementById('ssf').value;
  const dur=ini&&fim?durMin(ini,fim):0, saida=document.getElementById('ssaida').checked;
  const partes=[...document.querySelectorAll('.split-min')].map(x=>({area:x.dataset.area,min:Math.max(0,Math.round(+x.value||0))})).filter(p=>p.min>0);
  const soma=partes.reduce((s,p)=>s+p.min,0), box=document.getElementById('logAlert'), btn=document.getElementById('splitSalvar');
  if(!dur||soma!==dur){ box.innerHTML=`<div class="log-alert bloq"><b>Não dá para salvar</b>A soma das áreas (${soma} min) precisa fechar a duração (${dur} min).</div>`; return; }
  const base=hmToMin(ini); let cur=0;
  const toHM=m=>{m=((m%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
  const novos=partes.map(p=>{ const l={area:p.area,atividade:g.atividade,data:iso,ini:toHM(base+cur),fim:toHM(base+cur+p.min),obs:'',saida};
    // parte que começa depois da meia-noite pertence ao dia seguinte
    if(base+cur>=1440){ l.data=addDaysISO(iso,1); }
    cur+=p.min; return l; });
  const res={bloq:[],avisos:[]};
  novos.forEach(l=>{ const r=validarLog(l); res.bloq.push(...r.bloq); res.avisos.push(...r.avisos); });
  res.bloq=[...new Set(res.bloq)]; res.avisos=[...new Set(res.avisos)];
  if(res.bloq.length||(res.avisos.length&&btn.dataset.conf!=='1')){
    box.innerHTML=logAlertaHTML(res);
    if(!res.bloq.length){ btn.textContent='Salvar mesmo assim'; btn.dataset.conf='1'; }
    return;
  }
  novos.forEach(l=>store.logs.push({id:uid(),...l}));
  save(); closeModal(); _gaCache=null; renderCurrent();
  toast('✓ '+novos.map(l=>areaById(l.area).nome+' '+fmtDur(durMin(l.ini,l.fim)/60)).join(' + '));
}
export function mBloco(id=null,diaSel=''){
  const b = id ? store.grade.find(g=>g.id===id) : null;
  modal(`<h3>${b?'Editar bloco':'Novo bloco'}</h3>
    <div class="grid2">
      <div class="field"><label>Dia da semana</label><select id="bd">${DIAS.map(d=>`<option ${(b?b.dia:diaSel)===d?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="field"><label>Horário</label><input id="bh" placeholder="Ex: 20h-21h" value="${b?h(b.horario):''}"></div>
    </div>
    <div class="field"><label>Área</label><select id="ba">${areaOptions(b?b.area:'unitins')}</select></div>
    ${(()=>{const sp=b&&isPlainObj(b.split)?b.split:null;
      const outra=sp?Object.keys(sp).find(k=>k!==b.area):'';
      const pct=sp&&sp[b.area]!=null?sp[b.area]:50;
      return `<div class="grid2">
      <div class="field"><label>Dividir tempo com</label><select id="bsa"><option value="">— não dividir —</option>
        ${AREAS.filter(a=>a.conta).map(a=>`<option value="${a.id}" ${a.id===outra?'selected':''}>${a.nome}</option>`).join('')}</select></div>
      <div class="field"><label>% da área principal</label><input type="number" id="bsp" min="5" max="95" step="5" value="${pct}"></div></div>`;})()}
    <div class="field"><label>Atividade</label><input id="bat" placeholder="Ex: Espanhol Kultivi" value="${b?h(b.atividade):''}"></div>
    <label class="chk-line"><input type="checkbox" id="bsaida" ${b&&b.saida?'checked':''}>
      <span>Produção ativa<small>Falar, escrever, resolver exercícios. Sessões registradas por este bloco herdam a marcação.</small></span></label>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="saveBloco(${b?`'${id}'`:'null'})">${b?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('bh').focus(),50);
}
export function saveBloco(id){
  const dia=document.getElementById('bd').value, horario=document.getElementById('bh').value.trim(),
        area=document.getElementById('ba').value, atividade=document.getElementById('bat').value.trim();
  if(!horario||!atividade){toast('Preencha horário e atividade');return;}
  const outra=document.getElementById('bsa').value, pct=Math.max(5,Math.min(95,Math.round(+document.getElementById('bsp').value||50)));
  const saida=document.getElementById('bsaida').checked;
  if(outra&&outra===area){toast('Escolha uma área diferente da principal para dividir');return;}
  const split=outra?{[area]:pct,[outra]:100-pct}:null;
  let b;
  if(id){b=store.grade.find(g=>g.id===id);Object.assign(b,{dia,horario,area,atividade,saida});}
  else{b={id:uid(),dia,horario,area,atividade,saida,periodo:_vgPeriodo||(periodoAtivo()||{}).id||''};store.grade.push(b);}
  if(split) b.split=split; else delete b.split;
  save();closeModal();vGrade();toast(id?'Bloco atualizado':'Bloco adicionado');
}
export function delBloco(id){store.grade=store.grade.filter(g=>g.id!==id);save();vGrade();}

/* ---- CRUD de períodos letivos ---- */
export function mPeriodos(){
  const linhas=store.periodos.map(p=>{
    const nM=store.materias.filter(m=>m.periodo===p.id).length, nG=gradeDoPeriodo(p.id).length;
    const atv=(periodoAtivo()||{}).id===p.id;
    return `<tr><td><b>${h(p.nome)}</b>${atv?' <span class="pill green" style="font-size:10px">vigente</span>':periodoEncerrado(p)?' <span class="pill gray" style="font-size:10px">encerrado</span>':''}</td>
      <td style="white-space:nowrap">${fmtBR(p.ini)} – ${fmtBR(p.fim)}</td>
      <td style="color:var(--muted);font-size:12px">${nM} matérias · ${nG} blocos</td>
      <td style="white-space:nowrap"><button class="icon-btn" onclick="mPeriodo('${p.id}')" title="Editar">✎</button>
      <button class="icon-btn" onclick="delPeriodo('${p.id}')" title="Excluir">✕</button></td></tr>`;}).join('');
  modal(`<h3>Períodos letivos</h3>
    <div class="h-sub">O Hub UNITINS e a Grade são recortados por período. Analytics e Hábitos continuam por ano civil — são métricas de tempo, não de semestre.</div>
    <div class="table-wrap" style="margin:12px 0"><table><thead><tr><th>Período</th><th>Intervalo</th><th>Conteúdo</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
    <button class="btn" onclick="mPeriodo()">+ Novo período</button></div>`);
}
export function mPeriodo(id=null){
  const p=id?periodoById(id):null;
  const ult=[...store.periodos].sort((a,b)=>b.fim.localeCompare(a.fim))[0];
  const sugIni=p?p.ini:(ult?addDaysISO(ult.fim,1):todayISO());
  modal(`<h3>${p?'Editar período':'Novo período letivo'}</h3>
    <div class="field"><label>Nome</label><input id="pen" placeholder="Ex: 2027.1" value="${p?h(p.nome):''}"></div>
    <div class="grid2">
      <div class="field"><label>Início</label><input type="date" id="pei" value="${p?p.ini:sugIni}"></div>
      <div class="field"><label>Fim</label><input type="date" id="pef" value="${p?p.fim:''}"></div>
    </div>
    <div style="font-size:11px;color:var(--faint)">Períodos não podem se sobrepor — o sistema decide a qual semestre uma semana pertence pela data, e sobreposição tornaria essa resposta ambígua.</div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="savePeriodo(${p?`'${id}'`:'null'})">${p?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('pen').focus(),50);
}
export function savePeriodo(id){
  const nome=document.getElementById('pen').value.trim();
  const ini=document.getElementById('pei').value, fim=document.getElementById('pef').value;
  if(!nome||!ini||!fim){toast('Preencha nome, início e fim');return;}
  if(fim<ini){toast('O fim não pode ser antes do início');return;}
  const conflito=store.periodos.find(p=>p.id!==id&&!(fim<p.ini||ini>p.fim));
  if(conflito){toast('Sobrepõe o período "'+conflito.nome+'"');return;}
  if(id){Object.assign(periodoById(id),{nome,ini,fim});}
  else{store.periodos.push({id:uid(),nome,ini,fim});}
  save();closeModal();renderCurrent();toast(id?'Período atualizado':'Período criado');
}
export function delPeriodo(id){
  if(store.periodos.length<=1){toast('Precisa existir ao menos um período');return;}
  const p=periodoById(id); if(!p)return;
  const nM=store.materias.filter(m=>m.periodo===id).length, nG=gradeDoPeriodo(id).length;
  if(!confirm(`Excluir "${p.nome}"?\nAs ${nM} matérias e ${nG} blocos ficarão sem período e serão realocados no período vigente.`))return;
  store.periodos=store.periodos.filter(x=>x.id!==id);
  const novo=(periodoAtivo()||{}).id||'';
  store.materias.forEach(m=>{if(m.periodo===id)m.periodo=novo;});
  store.grade.forEach(g=>{if(g.periodo===id)g.periodo=novo;});
  save();closeModal();renderCurrent();toast('Período excluído');
}
export function mCopiarGrade(){
  const outros=store.periodos.filter(p=>p.id!==_vgPeriodo&&gradeDoPeriodo(p.id).length);
  if(!outros.length){toast('Nenhum outro período tem blocos');return;}
  modal(`<h3>Copiar grade</h3>
    <div class="h-sub">Duplica todos os blocos do período escolhido para <b>${h((periodoById(_vgPeriodo)||{}).nome||'')}</b>. Os originais não são alterados.</div>
    <div class="field" style="margin-top:12px"><label>Copiar de</label>
      <select id="cgp">${outros.map(p=>`<option value="${p.id}">${h(periodoLabel(p))} — ${gradeDoPeriodo(p.id).length} blocos</option>`).join('')}</select></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="copiarGrade()">Copiar</button></div>`);
}
export function copiarGrade(){
  const de=document.getElementById('cgp').value;
  const blocos=gradeDoPeriodo(de);
  blocos.forEach(g=>store.grade.push({...g,id:uid(),periodo:_vgPeriodo}));
  save();closeModal();vGrade();toast(blocos.length+' blocos copiados');
}

/* ---------------- Hub UNITINS ---------------- */
/* Status da matéria: derivado das aulas por padrão (statusManual=false).
   Se você editar o select, ele passa a manual (trava) até você devolver ao automático. */
