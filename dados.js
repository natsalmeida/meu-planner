// features/dados.js — gerado a partir do monólito; edite aqui a partir de agora.
import { ROOT, applyData, isPlainObj, store, validateStore } from '../core/store.js';
import { SYNC_INFO, SYNC_ST, syncHaQuanto } from '../core/sync-status.js';
import { SYNC_COLS, SYNC_SCHEMA, remoteFlat, save, unflatten } from '../core/sync.js';
import { authUser } from '../core/auth.js';
import { fmtBR, localISO, todayISO } from '../core/datas.js';
import { auditarLogs, logRotulo } from './validacao.js';
import { h, modal, toast } from '../ui/base.js';
import { current, go } from '../ui/router.js';
import { addDaysISO, anMonday } from '../views/analytics/graficos.js';
import { FIN_ROOT } from '../financas/core.js';

/* ---------------- Export / Import ---------------- */
/* ---------------- Diagnóstico de volume ----------------
   O gargalo não é a contagem de registros, é o tamanho do payload: save() envia
   o store inteiro ao Firebase a cada mutação. Medir bytes é o que importa. */
export const DIAG_LIMITES={aviso:400*1024, critico:1024*1024, localStorage:5*1024*1024};
export function fmtBytes(b){
  if(b<1024)return b+' B';
  if(b<1024*1024)return (b/1024).toFixed(1).replace('.',',')+' KB';
  return (b/1024/1024).toFixed(2).replace('.',',')+' MB';
}
export function diagnostico(){
  const json=JSON.stringify(store);
  const bytes=new Blob([json]).size;
  const partes=[
    ['Sessões do diário','logs',store.logs.length],
    ['Aulas gravadas','aulas',store.aulas.length],
    ['Aulas síncronas','sincronas',store.sincronas.length],
    ['Entregáveis','entregaveis',store.entregaveis.length],
    ['Pendências','pendencias',store.pendencias.length],
    ['Matérias','materias',store.materias.length],
    ['Blocos de grade','grade',store.grade.length],
    ['Dias de hábito','habitLog',Object.keys(store.habitLog).length],
    ['Livros lidos','livros',store.livros.length],
    ['Check-ins de nível','checkins',store.checkins.length],
  ].map(([nome,k,n])=>({nome,n,bytes:new Blob([JSON.stringify(store[k])]).size}))
   .sort((a,b)=>b.bytes-a.bytes);
  const registros=store.logs.length+store.aulas.length+store.sincronas.length
    +store.entregaveis.length+store.pendencias.length+Object.keys(store.habitLog).length;

  // ritmo real: sessões por semana nas últimas 8 semanas completas
  let sess=0;
  const ini=addDaysISO(localISO(anMonday(-8)),0), fim=addDaysISO(localISO(anMonday(0)),-1);
  store.logs.forEach(l=>{if(l.data>=ini&&l.data<=fim)sess++;});
  const porSemana=sess/8;
  const bytesPorLog=store.logs.length?new Blob([JSON.stringify(store.logs)]).size/store.logs.length:150;
  const crescimentoSemana=porSemana*bytesPorLog;
  const faltaCritico=Math.max(0,DIAG_LIMITES.critico-bytes);
  const semanas=crescimentoSemana>0?Math.round(faltaCritico/crescimentoSemana):null;
  const dataLimite=semanas!=null?addDaysISO(todayISO(),semanas*7):null;

  const nivel=bytes>=DIAG_LIMITES.critico?'critico':bytes>=DIAG_LIMITES.aviso?'aviso':'ok';
  return {bytes,partes,registros,porSemana,crescimentoSemana,semanas,dataLimite,nivel};
}
export function mDiagnostico(){
  const d=diagnostico();
  const cor=d.nivel==='critico'?'var(--red)':d.nivel==='aviso'?'var(--amber)':'var(--green)';
  const rotulo=d.nivel==='critico'?'Carregamento inicial pesado — hora de arquivar anos anteriores'
             :d.nivel==='aviso'?'Ainda tranquilo, mas já dá para planejar'
             :'Saudável';
  const pctLS=Math.min(100,d.bytes/DIAG_LIMITES.localStorage*100);
  modal(`<h3>Saúde dos dados</h3>
    <div class="h-sub">Cada gravação envia só o que mudou. O tamanho total pesa no primeiro carregamento de cada aparelho e no espelho local do navegador.</div>

    ${(()=>{const i=SYNC_INFO[SYNC_ST.estado]||SYNC_INFO.conectando;
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border-radius:10px;margin:14px 0;
        background:${i.cor}14;border:1px solid ${i.cor}44">
        <span style="color:${i.cor};font-size:12px;line-height:1.5">${i.ic}</span>
        <div style="font-size:13px;min-width:0">
          <b style="color:${i.cor}">Sincronização: ${i.txt}</b>
          <div style="color:var(--muted);font-size:12px;margin-top:2px">
            ${SYNC_ST.estado==='ok'?'Último envio confirmado pelo Firebase '+h(syncHaQuanto())+'.'
             :h(SYNC_ST.erro||'Aguardando resposta do servidor.')}
          </div>
          ${SYNC_ST.estado==='bloqueado'?`<div style="color:var(--muted);font-size:11px;margin-top:5px">
            Firebase Console → Realtime Database → Regras. O nó <code>meu_planner</code> precisa permitir leitura e escrita para a sua sessão.</div>`:''}
          ${SYNC_ST.estado==='local'?`<div style="color:var(--muted);font-size:11px;margin-top:5px">
            Seus dados continuam salvos neste navegador, mas <b>não estão indo para a nuvem</b> — outro aparelho não vai enxergá-los, e limpar os dados do site apagaria tudo. Exporte um backup antes de mexer em qualquer configuração.</div>`:''}
        </div></div>`;})()}
    ${(()=>{
      if(!authUser) return `<div style="padding:11px 13px;border-radius:10px;background:var(--amber-soft);color:var(--amber);font-size:12px;margin:14px 0">
        Você não está autenticado. Entre com o Google para ver o seu UID e a regra de segurança correspondente.</div>`;
      const uid=authUser.uid;
      const regras=`{\n  "rules": {\n    "${ROOT}": {\n      ".read": "auth.uid === '${uid}'",\n      ".write": "auth.uid === '${uid}'",\n      ".validate": "newData.child('_schema').val() === ${SYNC_SCHEMA}"\n    },\n    "${FIN_ROOT}": {\n      ".read": "auth.uid === '${uid}'",\n      ".write": "auth.uid === '${uid}'"\n    }\n  }\n}`;
      return `<div style="border:1px solid var(--line);border-radius:11px;padding:13px;margin:14px 0">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">Regra de segurança para este projeto</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:9px">
          Cole isto em Firebase Console → Realtime Database → Regras. Com o login do Google o UID nunca muda,
          então esta regra vale para sempre e em qualquer aparelho — diferente do login anônimo, que gerava um UID novo a cada navegador.
        </div>
        <pre id="regrasBox" style="background:var(--card-2);border:1px solid var(--line);border-radius:8px;padding:10px;
          font-size:11px;line-height:1.5;overflow-x:auto;margin:0;white-space:pre">${h(regras)}</pre>
        <div style="display:flex;gap:8px;align-items:center;margin-top:9px;flex-wrap:wrap">
          <button class="btn sm line" onclick="copiarRegras()">Copiar regra</button>
          <span style="font-size:10px;color:var(--faint);font-family:monospace">UID: ${h(uid)}</span>
        </div>
      </div>`;})()}
    <div class="stat-row" style="margin:14px 0">
      <div class="stat"><b style="color:${cor}">${fmtBytes(d.bytes)}</b><span>tamanho total na nuvem</span></div>
      <div class="stat"><b>${d.registros}</b><span>registros no total</span></div>
      <div class="stat"><b>${d.porSemana.toFixed(1).replace('.',',')}</b><span>sessões/semana (8 sem)</span></div>
    </div>

    <div style="padding:11px 13px;border-radius:10px;background:${cor}18;color:${cor};font-size:13px;font-weight:600;margin-bottom:14px">
      ${rotulo}${d.nivel!=='critico'&&d.semanas!=null?` — no ritmo atual, o limite de 1 MB chega em <b>~${d.semanas} semanas</b> (${fmtBR(d.dataLimite)})`:''}
    </div>

    <div class="h-sub" style="margin-bottom:6px">Ocupação do espelho local (limite ~5 MB do navegador)</div>
    <div class="progress" style="height:9px;margin-bottom:16px"><i style="width:${pctLS}%;background:${cor}"></i></div>

    <div class="table-wrap"><table><thead><tr><th>Coleção</th><th>Itens</th><th>Tamanho</th></tr></thead><tbody>
      ${d.partes.map(p=>`<tr><td>${h(p.nome)}</td><td>${p.n}</td><td><b>${fmtBytes(p.bytes)}</b></td></tr>`).join('')}
    </tbody></table></div>

    ${(()=>{const a=auditarLogs();
      if(!a.length) return `<div class="log-alert" style="background:var(--green-soft);color:var(--green);margin-top:14px"><b>Sessões consistentes</b>Nenhuma sobreposição, duração anormal ou data impossível no histórico.</div>`;
      return `<div style="border:1px solid var(--line);border-radius:11px;padding:12px 13px;margin-top:14px">
        <div style="font-size:13px;font-weight:700">${a.length} ${a.length===1?'sessão com problema':'sessões com problema'}</div>
        <div style="font-size:11px;color:var(--muted);margin:2px 0 6px">Registradas antes da validação. Distorcem as horas do Analytics até serem corrigidas.</div>
        <div style="max-height:240px;overflow-y:auto">${a.slice(0,50).map(x=>`<div class="audit-item"><div class="t">
          <b>${h(logRotulo(x.l))}</b><small>${x.probs.map(h).join(' ')}</small></div>
          <button class="btn sm line" onclick="mNovaSessao('','${x.l.id}')">Editar</button>
          <button class="icon-btn" title="Excluir" onclick="if(confirm('Excluir esta sessão?')){delLog('${x.l.id}');mDiagnostico();}">✕</button></div>`).join('')}</div>
        ${a.length>50?`<div style="font-size:11px;color:var(--faint);margin-top:6px">Mostrando as 50 mais recentes.</div>`:''}</div>`;})()}
    <div style="font-size:11px;color:var(--faint);margin-top:12px">
      Referência: <b>abaixo de 400 KB</b> nada precisa mudar. Entre 400 KB e 1 MB a sincronização começa a ficar perceptível em rede ruim.
      A gravação já é por entidade; acima de 1 MB o custo passa a ser só o download inicial em cada aparelho.
      Sessões antigas nunca precisam ser apagadas: dá para arquivá-las num nó separado que o app carrega só quando você abre um ano anterior.
    </div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Fechar</button>
    <button class="btn" onclick="exportData()">Exportar backup</button></div>`);
}

export function copiarRegras(){
  const el=document.getElementById('regrasBox'); if(!el)return;
  const txt=el.textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=>toast('Regra copiada')).catch(()=>toast('Copie manualmente do bloco acima'));
  }else toast('Copie manualmente do bloco acima');
}
export function exportData(){const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='planner-estudos-backup-'+todayISO()+'.json';a.click();toast('Backup exportado');}
export function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();
  r.onload=e=>{
    let d; try{ d=JSON.parse(e.target.result); }catch(err){ toast('Arquivo inválido (JSON malformado)'); inp.value=''; return; }
    if(isPlainObj(d)&&isPlainObj(d[ROOT])) d=d[ROOT];                         // export da raiz pelo Console
    if(isPlainObj(d)&&(d._schema!=null||SYNC_COLS.some(c=>isPlainObj(d[c])))) d=unflatten(remoteFlat(d)); // formato 5
    if(!validateStore(d)){ toast('Backup incompatível — estrutura inesperada'); inp.value=''; return; }
    const resumo=`Isto vai SUBSTITUIR seus dados atuais por:\n`
      +`• ${(d.logs||[]).length} sessões\n• ${(d.pendencias||[]).length} pendências\n`
      +`• ${(d.materias||[]).length} matérias · ${(d.entregaveis||[]).length} entregáveis\n`
      +`• ${(d.habitos||[]).length} hábitos · ${(d.sincronas||[]).length} aulas síncronas\n\nContinuar?`;
    if(!confirm(resumo)){ inp.value=''; return; }
    if(applyData(d)){ save(); go(current); toast('Dados importados'); }
    else toast('Falha ao aplicar o backup');
    inp.value='';
  };
  r.readAsText(f);}
