// financas/config.js — gerado a partir do monólito; edite aqui a partir de agora.
import { isPlainObj } from '../core/store.js';
import { fmtBR, todayISO } from '../core/datas.js';
import { closeModal, h, modal, toast } from '../ui/base.js';
import { addDaysISO } from '../views/analytics/graficos.js';
import { fin, finCat, finSave } from './core.js';
import { finCatListaHTML } from './categorias.js';
import { brl, finCompDe, finFaturasDaComp, finVal, ymAdd } from './util.js';
import { FIN_ST, vFinancas } from './view.js';

/* ---- configurações, backup, avisos ---- */
export function finCfg(){
  const apr=Object.entries(fin.aprendido).sort((a,b)=>a[0].localeCompare(b[0]));
  modal(`<h3>Finanças · ajustes</h3>
    <div class="field"><label>Dia de virada das faturas</label><input type="number" id="cfV" min="0" max="28" value="${fin.cfg.diaVirada}">
      <div class="h-sub" style="margin-top:5px">Fatura de cartão que vence até este dia do mês entra na competência anterior (ex.: Caixa vence 08/out → setembro). Contas comuns usam a competência que você escolher.</div></div>
    <label class="fin-chk"><input type="checkbox" id="cfS" ${fin.cfg.vozConfirma?'checked':''}> Depois de ler em voz alta, ouvir “sim/não” para confirmar</label>
    <div class="field" style="margin-top:14px"><label style="display:flex;align-items:center">Categorias de gasto
        <button class="btn sm" style="margin-left:auto" onclick="finCatModal()">＋ Nova categoria</button></label>
      <div class="fin-cat-lista">${finCatListaHTML()}</div></div>
    <div class="field" style="margin-top:14px"><label>Palavras que aprendi (${apr.length})</label>
      <div class="fin-apr">${apr.length?apr.map(([w,c])=>`<span class="chip">${h(w)} → ${finCat(c).nome} <button class="icon-btn" onclick="finEsquecer('${w}')">✕</button></span>`).join(''):'<span class="h-sub">Nada ainda — corrija uma categoria no “Confere?” e eu memorizo.</span>'}</div></div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
      <button class="btn" onclick="finSalvarCfg()">Salvar</button></div>`);
}
export function finEsquecer(w){delete fin.aprendido[w]; finSave(); finCfg();}
export function finSalvarCfg(){
  fin.cfg.diaVirada=Math.min(28,Math.max(0,parseInt(finVal('cfV'))||0));
  fin.cfg.vozConfirma=document.getElementById('cfS').checked;
  finSave(); closeModal(); FIN_ST.comp=null; vFinancas(); toast('Ajustes salvos');
}
export function finExport(){
  const blob=new Blob([JSON.stringify(fin,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='financas-backup-'+todayISO()+'.json'; a.click(); toast('Backup das finanças exportado');
}
export function finImport(inp){
  const f=inp.files[0]; if(!f)return; const r=new FileReader();
  r.onload=e=>{ let d; try{d=JSON.parse(e.target.result);}catch(err){toast('JSON inválido');inp.value='';return;}
    if(!isPlainObj(d)||!('gastos' in d||'contas' in d||'cartoes' in d)){toast('Não é um backup de finanças');inp.value='';return;}
    const n=k=>Array.isArray(d[k])?d[k].length:0;
    if(!confirm(`Substituir as finanças atuais por:\n• ${n('contas')} contas/receitas\n• ${n('gastos')} gastos\n• ${n('cartoes')} cartões\n• ${n('modelos')} fixos\n\nContinuar?`)){inp.value='';return;}
    Object.assign(fin,{contas:[],modelos:[],gastos:[],cartoes:[],faturasPagas:{},faturasValor:{},aprendido:{},catsExtra:[],cfg:{}},d);
    finSave(); vFinancas(); toast('Finanças restauradas'); inp.value=''; };
  r.readAsText(f);
}
export function finAvisos(){
  if(typeof Notification==='undefined'||Notification.permission!=='granted') return;
  const hoje=todayISO(), amanha=addDaysISO(hoje,1), key='planner_fin_notif_'+hoje;
  let ja={}; try{ja=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
  const itens=[];
  fin.contas.filter(c=>c.tipo==='despesa'&&!c.ok&&c.venc&&c.venc<=amanha&&c.venc>=addDaysISO(hoje,-3)).forEach(c=>itens.push({id:c.id,t:c.desc,v:c.valor,d:c.venc}));
  [finCompDe(hoje),ymAdd(finCompDe(hoje),-1)].forEach(M=>finFaturasDaComp(M).filter(f=>!f.ok&&f.venc<=amanha&&f.venc>=addDaysISO(hoje,-3)).forEach(f=>itens.push({id:f.id,t:f.desc,v:f.valor,d:f.venc})));
  itens.filter(i=>!ja[i.id]).slice(0,4).forEach(i=>{
    try{ new Notification('💸 '+i.t,{body:`${brl(i.v)} · ${i.d<hoje?'VENCIDA em':i.d===hoje?'vence hoje':'vence amanhã'} ${i.d<hoje?fmtBR(i.d):''}`.trim()}); }catch(e){}
    ja[i.id]=1; });
  try{localStorage.setItem(key,JSON.stringify(ja));}catch(e){}
}
