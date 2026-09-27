// views/habitos/estante.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from '../../core/store.js';
import { save } from '../../core/sync.js';
import { uid } from '../../core/app.js';
import { todayISO } from '../../core/datas.js';
import { closeModal, h, modal, toast } from '../../ui/base.js';
import { anoAtual } from '../analytics/graficos.js';
import { __set_hbAno, vHabitos } from './habitos.js';

export const MESES_CURTO=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export function livrosDoAno(ano){return store.livros.filter(lv=>+String(lv.mes).slice(0,4)===ano)
  .sort((a,b)=>String(b.mes).localeCompare(String(a.mes))||String(a.titulo).localeCompare(String(b.titulo)));}
export function mesLabel(mes){const[y,m]=String(mes).split('-');return (MESES_CURTO[+m-1]||'?')+'/'+String(y).slice(2);}
export function hbEstante(hb,ano){
  const livros=livrosDoAno(ano), ehAtual=ano===anoAtual();
  const paginas=livros.reduce((s,lv)=>s+(lv.paginas||0),0);
  const comPag=livros.filter(lv=>lv.paginas>0);
  // meses decorridos: no ano corrente o ritmo é sobre o que já passou, senão
  // dezembro puxaria a média para baixo em janeiro e o número não diria nada.
  const mesesCorridos=ehAtual?(new Date().getMonth()+1):12;
  const ritmo=livros.length/mesesCorridos;

  const porMes=Array.from({length:12},()=>({n:0,p:0}));
  livros.forEach(lv=>{const i=+String(lv.mes).slice(5,7)-1; if(i>=0&&i<12){porMes[i].n++;porMes[i].p+=lv.paginas||0;}});
  const maxP=Math.max(1,...porMes.map(x=>x.p));
  const barras=`<div class="est-meses">${porMes.map((x,i)=>`
    <div class="est-mes ${x.n?'on':''}" title="${MESES_CURTO[i]}/${ano}: ${x.n} ${x.n===1?'livro':'livros'}${x.p?' · '+x.p+' páginas':''}">
      <div class="est-bar"><i style="height:${x.p?Math.max(8,x.p/maxP*100):0}%;background:${hb.cor}"></i></div>
      <span>${MESES_CURTO[i]}</span><b>${x.n||''}</b>
    </div>`).join('')}</div>`;

  const grupos=[...new Set(livros.map(lv=>lv.mes))].map(mes=>{
    const doMes=livros.filter(lv=>lv.mes===mes);
    return `<div class="est-grupo"><div class="est-gh">${mesLabel(mes)} <span>${doMes.length} ${doMes.length===1?'livro':'livros'}${doMes.reduce((s,l)=>s+(l.paginas||0),0)?' · '+doMes.reduce((s,l)=>s+(l.paginas||0),0)+' pág.':''}</span></div>
      ${doMes.map(lv=>`<div class="est-item">
        <div class="est-cap" style="background:${hb.cor}1f;color:${hb.cor}">${h((lv.titulo||'?').trim().charAt(0).toUpperCase())}</div>
        <div class="est-body"><div class="t">${h(lv.titulo)}</div>
          <div class="m">${lv.autor?h(lv.autor):'<i style="opacity:.55">sem autor</i>'}${lv.paginas?` · ${lv.paginas} pág.`:''}</div></div>
        <button class="icon-btn" onclick="mLivro('${lv.id}')" title="Editar">✎</button>
        <button class="icon-btn" onclick="delLivro('${lv.id}')" title="Excluir">✕</button>
      </div>`).join('')}</div>`;}).join('');

  return `<div class="estante">
    <div class="est-head">
      <b>📚 Estante · ${ano}</b>
      <button class="btn sm line" onclick="mLivro(null)">+ Livro</button>
    </div>
    <div class="est-stats">
      <span class="pill purple">${livros.length} ${livros.length===1?'livro':'livros'}</span>
      ${paginas?`<span class="pill blue">${paginas.toLocaleString('pt-BR')} páginas</span>`:''}
      ${comPag.length?`<span class="pill gray" title="${comPag.length} de ${livros.length} ${livros.length===1?'livro':'livros'} com nº de páginas preenchido — os demais ficam fora desta média">média ${Math.round(comPag.reduce((s,l)=>s+l.paginas,0)/comPag.length)} pág./livro</span>`:''}
      ${livros.length?`<span class="pill ${ritmo>=1?'green':'amber'}" title="${livros.length} ${livros.length===1?'livro':'livros'} em ${mesesCorridos} ${mesesCorridos===1?'mês decorrido':'meses decorridos'}">${ritmo.toFixed(1).replace('.',',')} livro/mês</span>`:''}
    </div>
    ${livros.length?barras+grupos:'<div class="empty" style="padding:16px">Nenhum livro registrado em '+ano+'.</div>'}
  </div>`;
}
export function mLivro(id=null){
  const lv=id?store.livros.find(x=>x.id===id):null;
  const mesPad=lv?lv.mes:todayISO().slice(0,7);
  modal(`<h3>${lv?'Editar livro':'Novo livro'}</h3>
    <div class="field"><label>Título</label><input id="lvt" placeholder="Ex: Clean Architecture" value="${lv?h(lv.titulo):''}"></div>
    <div class="field"><label>Autor</label><input id="lva" placeholder="Ex: Robert C. Martin" value="${lv?h(lv.autor||''):''}"></div>
    <div class="grid2">
      <div class="field"><label>Páginas</label><input type="number" id="lvp" min="0" step="1" placeholder="0" value="${lv&&lv.paginas?lv.paginas:''}"></div>
      <div class="field"><label>Mês da leitura</label><input type="month" id="lvm" value="${mesPad}"></div>
    </div>
    <div style="font-size:11px;color:var(--faint);margin:-6px 0 4px">O mês é o da <b>conclusão</b> — livro atravessando a virada do mês conta uma vez só, no mês em que terminou. Páginas em branco não entram na média.</div>
    <div class="modal-actions"><button class="btn line" onclick="closeModal()">Cancelar</button>
    <button class="btn" onclick="saveLivro(${lv?`'${id}'`:'null'})">${lv?'Salvar':'Adicionar'}</button></div>`);
  setTimeout(()=>document.getElementById('lvt').focus(),50);
}
export function saveLivro(id){
  const titulo=document.getElementById('lvt').value.trim();
  if(!titulo){toast('Dê um título ao livro');return;}
  const mes=document.getElementById('lvm').value;
  if(!/^\d{4}-\d{2}$/.test(mes)){toast('Informe o mês da leitura');return;}
  if(mes>todayISO().slice(0,7)){toast('Mês no futuro — a estante registra o que já foi lido');return;}
  const dados={titulo, autor:document.getElementById('lva').value.trim(),
    paginas:Math.max(0,+document.getElementById('lvp').value||0), mes};
  if(id){Object.assign(store.livros.find(x=>x.id===id),dados);}
  else{store.livros.push({id:uid(),...dados});}
  // Um livro cadastrado num ano sem marcações abre esse ano no seletor: pular
  // para o ano do livro evita o cadastro "sumir" logo depois de salvo.
  __set_hbAno(+mes.slice(0,4));
  save();closeModal();vHabitos();toast(id?'Livro atualizado':'Livro adicionado');
}
export function delLivro(id){
  const lv=store.livros.find(x=>x.id===id); if(!lv)return;
  if(!confirm('Excluir "'+lv.titulo+'" da estante?'))return;
  store.livros=store.livros.filter(x=>x.id!==id);
  save();vHabitos();toast('Livro removido');
}
