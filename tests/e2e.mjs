/* E2E contra o artefato de deploy (dist/index.html), não contra o código-fonte.
   Firebase falso compartilhado entre várias "abas" JSDOM, com a semântica relevante
   do RTDB (descarta null/[]/{}, update multi-caminho, eco para todos os ouvintes).
   Uso: npm test   (faz o build antes) */
import { JSDOM } from 'jsdom';
import fs from 'fs';

const BUILD = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
/* jsdom não executa <script type="module">. O bundle inline não tem imports, então basta
   reproduzir o que a semântica de módulo muda aqui: execução adiada (fim do body), strict mode
   e escopo próprio (IIFE) — sem ela, os nomes curtos do minificador vazariam para window. */
const HTML = (() => {
  const m = BUILD.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('bundle de módulo não encontrado no dist');
  // replacer em função: o JS minificado contém `$&`, que String.replace interpretaria como padrão
  return BUILD.replace(m[0], () => '').replace('</body>', () => `<script>(function(){"use strict";\n${m[1]}\n})();</script></body>`);
})();
const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
function norm(v) {
  if (v == null) return undefined;
  if (Array.isArray(v)) { const a = v.map(norm); return a.some((x) => x !== undefined) ? a : undefined; }
  if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { const c = norm(v[k]); if (c !== undefined) o[k] = c; } return Object.keys(o).length ? o : undefined; }
  return v;
}
function setPath(root, p, val) {
  const ps = p.split('/'); let n = root;
  for (let i = 0; i < ps.length - 1; i++) { n[ps[i]] = n[ps[i]] && typeof n[ps[i]] === 'object' ? n[ps[i]] : {}; n = n[ps[i]]; }
  n[ps.at(-1)] = val;
}

const server = { tree: {}, rules: false, log: [] };
const ouvintes = []; // {root, cb, inst}
const emitir = (root) => setTimeout(() => ouvintes.filter((o) => o.root === root && o.inst.vivo)
  .forEach((o) => o.cb({ val: () => clone(server.tree[root] ?? null) })), 0);

function aba(nome, { ls = {} } = {}) {
  const inst = { nome, vivo: true, erros: [] };
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://planner.test/',
    beforeParse(w) {
      for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, v);
      w.addEventListener('error', (e) => inst.erros.push(String(e.message)));
      w.console.error = (...a) => inst.erros.push(a.map(String).join(' '));
      w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
      const user = { uid: 'U1', isAnonymous: false, displayName: 'Teste', email: 't@t' };
      const auth = { onAuthStateChanged: (cb) => setTimeout(() => cb(user), 5), getRedirectResult: () => Promise.resolve(), signOut: () => Promise.resolve(), currentUser: user };
      const authFn = () => auth; authFn.GoogleAuthProvider = function () {};
      w.firebase = {
        initializeApp() {}, auth: authFn,
        database: () => ({ ref: (root) => ({
          on(ev, cb) { ouvintes.push({ root, cb, inst }); setTimeout(() => inst.vivo && cb({ val: () => clone(server.tree[root] ?? null) }), 0); },
          off() { for (let i = ouvintes.length - 1; i >= 0; i--) if (ouvintes[i].inst === inst && ouvintes[i].root === root) ouvintes.splice(i, 1); },
          set(v) {
            if (server.rules && root === 'meu_planner' && !(v && v._schema === 5)) { server.log.push(`${nome}:set RECUSADO`); return Promise.reject({ code: 'PERMISSION_DENIED' }); }
            server.tree[root] = norm(clone(v)) ?? null; server.log.push(`${nome}:set`); emitir(root); return Promise.resolve();
          },
          update(u) {
            const t = clone(server.tree[root]) || {}; for (const k of Object.keys(u)) setPath(t, k, clone(u[k]));
            server.tree[root] = norm(t) ?? null; server.log.push(`${nome}:update[${Object.keys(u).join(',')}]`); emitir(root); return Promise.resolve();
          },
        }) }),
      };
    },
  });
  inst.w = dom.window; inst.d = dom.window.document; inst.P = dom.window.__planner;
  inst.fechar = () => { inst.vivo = false; dom.window.close(); };
  return inst;
}

const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FALHOU ') + m); if (!c) falhas++; };
const secao = (t) => console.log('\n' + t);

/* ---------------------------------------------------------------- */
secao('Carga e ponte de handlers');
const A = aba('A'); await espera(250);
const S = () => A.P.store;
ok(A.erros.length === 0, 'app sobe sem erro de runtime ' + (A.erros[0] || ''));
ok(server.tree.meu_planner?._schema === 5, 'estado inicial gravado no schema 5');
const pol = S().grade.find((g) => /poliglota/i.test(g.atividade));
ok(pol?.split?.ingles === 50 && pol.split.espanhol === 50, 'semeadura do split do Poliglota');

// Toda view renderizada: cada função chamada num on*="" precisa existir em window
const views = ['dashboard', 'calendario', 'pendencias', 'diarios', 'grade', 'unitins', 'analytics', 'habitos', 'financas'];
const faltando = new Set();
const varrer = () => {
  for (const el of A.d.querySelectorAll('*')) for (const at of el.attributes) {
    if (!/^on/.test(at.name)) continue;
    for (const m of at.value.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const f = m[1]; if (['if', 'confirm', 'event', 'alert', 'Number', 'parseInt', 'String'].includes(f)) continue;
      if (typeof A.w[f] !== 'function' && !(f in A.d)) faltando.add(f + ' ← ' + at.name);
    }
  }
};
for (const v of views) { if (A.P.VIEWS[v] || v === 'financas') { A.w.go(v); await espera(20); varrer(); } }
// modais também geram handlers
for (const abre of ['mPendencia()', "mNovaSessao('ingles')", `mBloco('${pol.id}')`, "mCheckin('ingles')", 'mDiagnostico()', 'mPeriodos()']) {
  A.w.eval(abre); await espera(90); varrer(); A.w.closeModal(); await espera(10);
}
ok(faltando.size === 0, `todo handler inline resolve para uma função em window${faltando.size ? ': ' + [...faltando].slice(0, 6).join(' | ') : ''}`);
ok(A.erros.length === 0, 'navegação por todas as views e modais sem erro ' + (A.erros[0] || ''));

/* ---------------------------------------------------------------- */
secao('Grade dividida (item 4)');
const pl = A.P.planoPorAreaRange('2026-10-03', '2026-10-03').min;
ok(pl.ingles === 45 && pl.espanhol === 45, `plano de sábado: inglês ${pl.ingles} / espanhol ${pl.espanhol} min`);
{
  const hoje = A.P.todayISO(), dia = A.P.DIAS[(new Date(hoje + 'T12:00').getDay() + 6) % 7];
  const per = A.P.periodoAtivo() || A.P.periodoDe(hoje);
  const gradeOrig = S().grade, logsOrig = S().logs;
  S().grade = [{ id: 'gx', dia, horario: '00h00-01h30', area: 'ingles', atividade: 'Poliglota', split: { ingles: 50, espanhol: 50 }, periodo: per.id }];
  S().logs = [{ id: 'x1', area: 'ingles', data: hoje, ini: '00:00', fim: '01:30' }];
  A.P.gradeWeekStats(); let a = A.P.weekAlloc().res.gx;
  ok(a.done && a.alloc === 90, '90 min só de inglês cumprem o bloco dividido');
  S().logs = [{ id: 'x2', area: 'espanhol', data: hoje, ini: '00:00', fim: '00:30' }];
  A.P.gradeWeekStats(); a = A.P.weekAlloc().res.gx;
  ok(!a.done && a.alloc === 30, '30 min de espanhol = parcial 30/90');
  S().grade = gradeOrig; S().logs = logsOrig; A.P.gradeWeekStats();
}
const ontem = A.P.addDaysISO(A.P.todayISO(), -1);
A.P.mCumprirSplit(pol.id, ontem); // não é handler inline: fica fora da ponte, de propósito await espera(20);
const ins = [...A.d.querySelectorAll('.split-min')];
ins[0].value = '60'; A.w.splitRecalc(0);
ok(ins[1].value === '30', 'distribuição real ajusta a outra área');
A.w.salvarSplit(pol.id, ontem); await espera(80);
const novos = S().logs.filter((l) => l.data === ontem && /poliglota/i.test(l.atividade));
ok(novos.map((l) => `${l.area} ${l.ini}-${l.fim}`).join(', ') === 'ingles 10:30-11:30, espanhol 11:30-12:00', 'sessões contíguas geradas');
ok(novos.length === 2 && Object.keys(server.tree.meu_planner.logs).length >= 2, 'sessões chegaram ao Firebase');

/* ---------------------------------------------------------------- */
secao('Validação de sessões (item 2)');
A.w.mNovaSessao('ingles'); await espera(90);
A.d.getElementById('sd').value = ontem; A.d.getElementById('si').value = '11:00'; A.d.getElementById('sf').value = '11:45';
A.w.addLog(null); await espera(10);
ok(/Sobrepõe/.test(A.d.getElementById('logAlert').textContent), 'sobreposição bloqueada');
// 3 dias atrás: em "ontem", 21:00→20:00 terminaria hoje às 20h (futuro) e seria bloqueio, não aviso
A.d.getElementById('sd').value = A.P.addDaysISO(A.P.todayISO(), -3);
A.d.getElementById('si').value = '21:00'; A.d.getElementById('sf').value = '20:00';
A.w.addLog(null); await espera(10);
ok(/acima do limite/.test(A.d.getElementById('logAlert').textContent) && A.d.getElementById('logSalvar').textContent === 'Salvar mesmo assim', 'erro 21:00→20:00 vira aviso com confirmação');
A.w.closeModal();

/* ---------------------------------------------------------------- */
secao('Output (item 4)');
A.w.mCheckin('espanhol'); await espera(90);
A.d.getElementById('ckN').value = 'A2+'; A.w.saveCheckin(null); await espera(60);
ok(Object.values(server.tree.meu_planner.checkins || {}).some((c) => c.nivel === 'A2+'), 'check-in sincronizado');
A.w.go('analytics'); await espera(30);
ok(/Produção × consumo/.test(A.d.getElementById('view').textContent), 'card de produção renderiza');

/* ---------------------------------------------------------------- */
secao('Sync granular (item 3) entre abas');
const B = aba('B'); await espera(250);
ok(B.P.store.logs.length === S().logs.length, 'B carrega o mesmo estado de A');
const n0 = server.log.length;
A.P.store.pendencias.push({ id: 'pA', titulo: 'de A', feito: false }); A.w.eval('0'); A.P.save();
B.P.store.logs.push({ id: 'lB', area: 'pibiex', data: ontem, ini: '20:00', fim: '21:00' }); B.P.save();
await espera(120);
ok(server.tree.meu_planner.pendencias.pA && server.tree.meu_planner.logs.lB, 'edições simultâneas preservadas no servidor');
ok(A.P.store.logs.some((l) => l.id === 'lB') && B.P.store.pendencias.some((p) => p.id === 'pA'), 'as duas abas convergem');
ok(server.log.slice(n0).every((x) => x.includes('update')), 'só update() granular, nenhum set() da árvore: ' + server.log.slice(n0).join(' '));

// aba B fecha; edição offline fica no espelho local; A segue editando
const lsB = {}; for (let i = 0; i < B.w.localStorage.length; i++) { const k = B.w.localStorage.key(i); lsB[k] = B.w.localStorage.getItem(k); }
B.fechar();
const LS = A.P.LS_KEY, offline = JSON.parse(lsB[LS]);
offline.logs.push({ id: 'lOff', area: 'ia', data: ontem, ini: '08:00', fim: '09:00' });
lsB[LS] = JSON.stringify(offline);
A.P.store.logs.push({ id: 'lA2', area: 'ia', data: ontem, ini: '13:00', fim: '14:00' }); A.P.save(); await espera(80);
const B2 = aba('B2', { ls: lsB }); await espera(300);
ok(server.tree.meu_planner.logs.lOff && server.tree.meu_planner.logs.lA2, 'reabrir aplica a edição offline sem perder a de A');
ok(A.P.store.logs.some((l) => l.id === 'lOff'), 'A recebe a edição offline de B');

// aba com código antigo grava árvore legada por cima
const legado = clone(A.P.store); legado.pendencias.push({ id: 'pV', titulo: 'app velho' }); delete legado._schema;
server.tree.meu_planner = norm(clone(legado)); emitir('meu_planner'); await espera(200);
ok(server.tree.meu_planner._schema === 5 && !Array.isArray(server.tree.meu_planner.logs), 'árvore legada reconvertida para o schema 5');
ok(A.P.store.pendencias.some((p) => p.id === 'pV'), 'conteúdo legado absorvido');
server.rules = true;
const antes = server.tree.meu_planner;
const V = { set: (v) => (server.rules && !(v && v._schema === 5) ? 'recusado' : 'aceito') };
ok(V.set(legado) === 'recusado' && server.tree.meu_planner === antes, 'com a regra .validate, set() legado é recusado');

/* ---------------------------------------------------------------- */
secao('Erros de runtime acumulados');
for (const x of [A, B2]) ok(x.erros.length === 0, `${x.nome}: ${x.erros.length} erro(s) ${x.erros.slice(0, 2).join(' | ')}`);

console.log(`\n${falhas ? '✘ ' + falhas + ' falha(s)' : '✔ tudo passou'}`);
process.exit(falhas ? 1 : 0);
