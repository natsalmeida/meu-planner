// financas/categorias.js — categorias de gasto criadas pelo usuário.
import { h, modal, toast } from '../ui/base.js';
import { FIN_CATS, FIN_CATS_BASE, FIN_CAT_PALETA, fin, finCatById, finRebuildCats, finSave } from './core.js';
import { finNorm } from './util.js';
import { finCfg } from './config.js';
import { vFinancas } from './view.js';

const ehBase = (id) => FIN_CATS_BASE.some((c) => c.id === id);
function slug(nome) {
  const b = 'u_' + (finNorm(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'cat');
  let id = b, i = 2;
  while (finCatById(id)) id = b + '_' + (i++);
  return id;
}
function proximaCor() {
  const usadas = new Set(FIN_CATS.map((c) => c.cor.toLowerCase()));
  return FIN_CAT_PALETA.find((c) => !usadas.has(c)) || FIN_CAT_PALETA[fin.catsExtra.length % FIN_CAT_PALETA.length];
}
const nomeDuplicado = (nome, ignorarId) => FIN_CATS.some((c) => c.id !== ignorarId && finNorm(c.nome) === finNorm(nome));
const parseKw = (t) => [...new Set(String(t || '').split(',').map((x) => finNorm(x).trim()).filter((x) => x.length >= 2))];

/* Cria e devolve o id; null se cancelado ou duplicado. */
export function finCriarCat(nome, cor, kw) {
  nome = String(nome || '').trim().slice(0, 40);
  if (!nome) return null;
  if (nomeDuplicado(nome)) { toast('Já existe uma categoria com esse nome'); return null; }
  const c = { id: slug(nome), nome, cor: cor || proximaCor(), kw: kw || [] };
  fin.catsExtra.push(c); finRebuildCats(); finSave();
  return c.id;
}

/* <option>s de categoria + "＋ Nova categoria…". O <select> usa onchange="finCatSelect(this)". */
export function finCatOptions(sel, vazio = false) {
  return (vazio ? '<option value="">—</option>' : '')
    + FIN_CATS.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${h(c.nome)}</option>`).join('')
    + '<option value="__nova">＋ Nova categoria…</option>';
}

/* Criação rápida sem fechar o formulário aberto: um modal por cima apagaria os campos já
   preenchidos. prompt() é síncrono, então quem lê this.value logo depois já recebe o id novo. */
export function finCatSelect(el) {
  if (el.value !== '__nova') { el.dataset.prev = el.value; return; }
  const id = finCriarCat(prompt('Nome da nova categoria:'));
  if (!id) { el.value = el.dataset.prev ?? el.options[0].value; return; }
  // atualiza todos os seletores abertos (ex.: as linhas da importação de fatura)
  document.querySelectorAll('select[data-fincat]').forEach((s) => {
    const v = s === el ? id : s.value, vazio = s.options[0] && s.options[0].value === '';
    s.innerHTML = finCatOptions(v, vazio); s.dataset.prev = v;
  });
  toast('Categoria criada');
}

export function finCatListaHTML() {
  return FIN_CATS.map((c) => {
    const n = fin.gastos.filter((g) => g.cat === c.id).length;
    return `<div class="fin-cat-row"><span class="tag-dot" style="background:${c.cor}"></span>
      <span class="t">${h(c.nome)}<small>${n} ${n === 1 ? 'gasto' : 'gastos'}</small></span>
      ${ehBase(c.id) ? '<span class="h-sub">padrão</span>'
        : `<button class="btn sm line" onclick="finCatModal('${c.id}')">Editar</button>
          <button class="icon-btn" title="Excluir" onclick="finCatExcluir('${c.id}')">✕</button>`}</div>`;
  }).join('');
}

export function finCatModal(id) {
  const c = id ? fin.catsExtra.find((x) => x.id === id) : null;
  const cor = c ? c.cor : proximaCor();
  modal(`<h3>${c ? 'Editar categoria' : 'Nova categoria'}</h3>
    <div class="field"><label>Nome</label><input id="fcnN" maxlength="40" value="${c ? h(c.nome) : ''}" placeholder="Ex.: Viagens"></div>
    <div class="field"><label>Cor</label>
      <div class="fin-cores">${FIN_CAT_PALETA.map((p) => `<button type="button" class="fin-cor ${p === cor ? 'on' : ''}" style="background:${p}"
        onclick="finCatCor(this,'${p}')"></button>`).join('')}
        <input type="color" id="fcnC" value="${cor}" title="Outra cor" oninput="finCatCor(null,this.value)"></div></div>
    <div class="field"><label>Palavras-chave (opcional)</label>
      <input id="fcnK" value="${c ? h(c.kw.join(', ')) : ''}" placeholder="Ex.: hotel, airbnb, passagem aerea">
      <div class="h-sub" style="margin-top:5px">Separadas por vírgula. Gastos ditos por voz ou importados da fatura que contenham essas palavras caem nesta categoria automaticamente.</div></div>
    <div class="modal-actions"><button class="btn line" onclick="finCfg()">Voltar</button>
      <button class="btn" onclick="finCatSalvar(${c ? `'${c.id}'` : 'null'})">Salvar</button></div>`);
  setTimeout(() => { const i = document.getElementById('fcnN'); if (i) i.focus(); }, 50);
}
export function finCatCor(btn, cor) {
  document.querySelectorAll('.fin-cor').forEach((b) => b.classList.toggle('on', b === btn));
  document.getElementById('fcnC').value = cor;
}
export function finCatSalvar(id) {
  const nome = document.getElementById('fcnN').value.trim().slice(0, 40);
  const cor = document.getElementById('fcnC').value, kw = parseKw(document.getElementById('fcnK').value);
  if (!nome) { toast('Informe o nome'); return; }
  if (nomeDuplicado(nome, id)) { toast('Já existe uma categoria com esse nome'); return; }
  if (id) { Object.assign(fin.catsExtra.find((x) => x.id === id), { nome, cor, kw }); finRebuildCats(); finSave(); }
  else if (!finCriarCat(nome, cor, kw)) return;
  toast('Categoria salva'); finCfg(); vFinancas();
}

/* Excluir não apaga lançamentos: gastos, contas e fixos da categoria passam para "Outros". */
export function finCatExcluir(id) {
  const c = fin.catsExtra.find((x) => x.id === id); if (!c) return;
  const usa = (x) => x.cat === id;
  const n = fin.gastos.filter(usa).length + fin.contas.filter(usa).length + fin.modelos.filter(usa).length;
  if (!confirm(`Excluir a categoria "${c.nome}"?${n ? `\n\n${n} lançamento(s) dela passam para "Outros".` : ''}`)) return;
  [...fin.gastos, ...fin.contas, ...fin.modelos].forEach((x) => { if (x.cat === id) x.cat = 'outros'; });
  Object.keys(fin.aprendido).forEach((w) => { if (fin.aprendido[w] === id) delete fin.aprendido[w]; });
  fin.catsExtra = fin.catsExtra.filter((x) => x.id !== id);
  finRebuildCats(); finSave(); toast('Categoria excluída'); finCfg(); vFinancas();
}
