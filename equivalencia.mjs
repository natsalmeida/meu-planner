/* Diferencial: monólito original × build modular, mesmos dados, mesma navegação.
   Compara o HTML de cada view. Qualquer diferença = regressão da modularização. */
import { JSDOM } from 'jsdom'; import fs from 'fs';
const [, , MONO, DIST] = process.argv;
const clone = (o) => JSON.parse(JSON.stringify(o));
const dados = JSON.parse(fs.readFileSync(new URL('./fixture.json', import.meta.url)));
function prepDist(b) {
  const m = b.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  return b.replace(m[0], () => '').replace('</body>', () => `<script>(function(){"use strict";\n${m[1]}\n})();</script></body>`);
}
function boot(html) {
  const tree = { meu_planner: clone(dados) }; const erros = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://planner.test/',
    beforeParse(w) {
      // relógio congelado: as duas versões veem o mesmo "agora"
      const T = new Date('2026-09-27T15:00:00').getTime(); const D = w.Date;
      w.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } };
      w.addEventListener('error', (e) => erros.push(e.message)); w.console.error = (...a) => erros.push(a.join(' '));
      w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
      const user = { uid: 'U1', isAnonymous: false };
      const auth = { onAuthStateChanged: (cb) => setTimeout(() => cb(user), 5), getRedirectResult: () => Promise.resolve(), signOut: () => Promise.resolve() };
      const af = () => auth; af.GoogleAuthProvider = function () {};
      w.firebase = { initializeApp() {}, auth: af, database: () => ({ ref: (r) => ({
        on(e, cb) { setTimeout(() => cb({ val: () => clone(tree[r] ?? null) }), 0); }, off() {},
        set(v) { tree[r] = clone(v); return Promise.resolve(); }, update() { return Promise.resolve(); } }) }) };
    } });
  return { w: dom.window, d: dom.window.document, erros };
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const M = boot(fs.readFileSync(MONO, 'utf8')), B = boot(prepDist(fs.readFileSync(DIST, 'utf8')));
await espera(400);
const views = ['dashboard', 'calendario', 'pendencias', 'diarios', 'grade', 'unitins', 'analytics', 'habitos', 'financas'];
let dif = 0;
const cmp = (rot) => {
  const a = M.d.getElementById('view').innerHTML, b = B.d.getElementById('view').innerHTML;
  const na = M.d.querySelector('nav, .sidebar, #nav')?.innerHTML, nb = B.d.querySelector('nav, .sidebar, #nav')?.innerHTML;
  const igual = a === b && na === nb;
  if (!igual) { dif++; let i = 0; while (a[i] === b[i]) i++; console.log(`  ✘ ${rot}: diverge em ${i}\n    mono: ${a.slice(i - 60, i + 80)}\n    dist: ${b.slice(i - 60, i + 80)}`); }
  else console.log(`  ✔ ${rot} (${a.length} chars idênticos)`);
};
for (const v of views) { M.w.go(v); B.w.go(v); await espera(30); cmp(v); }
// abas internas
for (const [fn, args] of [['setUni', ['materias']], ['setUni', ['aulas']], ['setUni', ['sincronas']], ['setUni', ['entregaveis']], ['setUni', ['diario']],
  ['setCalVista', ['ano']], ['setAnDias', [60]], ['finAba', ['gastos']], ['finAba', ['cartoes']], ['finAba', ['analytics']]]) {
  const alvo = fn.startsWith('fin') ? 'financas' : fn === 'setUni' ? 'unitins' : fn === 'setAnDias' ? 'analytics' : 'calendario';
  M.w.go(alvo); B.w.go(alvo); await espera(10);
  try { M.w[fn](...args); B.w[fn](...args); } catch (e) { console.log('  (pulado ' + fn + ': ' + e.message + ')'); continue; }
  await espera(30); cmp(`${alvo} › ${fn}(${args})`);
}
console.log(`\nerros runtime: mono ${M.erros.length}, dist ${B.erros.length}`);
console.log(dif ? `✘ ${dif} divergência(s)` : '✔ renderização idêntica ao monólito');
process.exit(dif ? 1 : 0);
