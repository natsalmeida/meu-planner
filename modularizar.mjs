/* Gera src/ a partir do script monolítico, preservando o código byte a byte.
   - Cada módulo = faixas de linhas alinhadas a declarações top-level (verificado via AST).
   - Exporta toda declaração top-level; importa só o que cada módulo referencia.
   - Reatribuição de `let` de outro módulo vira chamada de setter gerado no dono.
   - Funções usadas em handlers inline (onclick="...") são publicadas em window por main.js. */
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'fs';
import path from 'path';

const HTML = fs.readFileSync(process.argv[2], 'utf8');
const OUT = process.argv[3];
const i0 = HTML.indexOf('<script>', HTML.indexOf('firebase-auth.js'));
const i1 = HTML.indexOf('</script>', i0);
const JS = HTML.slice(i0 + 8, i1);
const LINES = JS.split('\n');
const END = LINES.length;

const MAPA = {
  'core/constantes.js': [[1, 17], [28, 61]],
  'core/periodos.js': [[18, 27]],
  'core/firebase.js': [[62, 76]],
  'core/store.js': [[77, 188]],
  'core/sync-status.js': [[189, 241]],
  'core/sync.js': [[242, 388], [506, 553]],
  'core/auth.js': [[389, 505]],
  'core/app.js': [[554, 576]],
  'core/datas.js': [[701, 723]],
  'core/horas.js': [[724, 725], [801, 831]],
  'features/timer.js': [[577, 700]],
  'features/validacao.js': [[726, 800]],
  'features/prazos.js': [[3886, 3922]],
  'features/dados.js': [[3923, 4071]],
  'ui/base.js': [[832, 843]],
  'ui/router.js': [[844, 879]],
  'views/dashboard.js': [[880, 1053]],
  'views/calendario.js': [[1054, 1239]],
  'views/pendencias.js': [[1240, 1287]],
  'views/diario.js': [[1288, 1429]],
  'views/grade.js': [[1430, 1836]],
  'views/unitins/hub.js': [[1837, 2039], [2414, 2438]],
  'views/unitins/aulas.js': [[2040, 2209]],
  'views/unitins/sincronas.js': [[2210, 2413]],
  'views/unitins/entregaveis.js': [[2439, 2648]],
  'views/analytics/graficos.js': [[2649, 3033]],
  'views/analytics/output.js': [[3034, 3140]],
  'views/analytics/analytics.js': [[3141, 3266]],
  'views/habitos/habitos.js': [[3267, 3607], [3692, 3885]],
  'views/habitos/estante.js': [[3608, 3691]],
  'financas/core.js': [[4072, 4189]],
  'financas/util.js': [[4190, 4260]],
  'financas/voz.js': [[4261, 4539]],
  'financas/view.js': [[4540, 5155]],
  'financas/dashboard.js': [[5156, 5190]],
  'financas/analytics.js': [[5191, 5378]],
  'financas/config.js': [[5379, 5424]],
  'main.js': [[5425, END]],
};
const ORDEM = Object.keys(MAPA); // ordem original do arquivo = ordem de import no main
const erro = (m) => { console.error('ERRO: ' + m); process.exit(1); };

// cobertura total e sem sobreposição
const dono = new Array(END + 1).fill(null);
for (const [m, rs] of Object.entries(MAPA)) for (const [a, b] of rs) for (let l = a; l <= b; l++) {
  if (dono[l]) erro(`linha ${l} em ${dono[l]} e ${m}`); dono[l] = m;
}
for (let l = 1; l <= END; l++) if (!dono[l] && LINES[l - 1].trim()) erro(`linha ${l} sem módulo: ${LINES[l - 1].slice(0, 60)}`);

const ast = acorn.parse(JS, { ecmaVersion: 'latest', locations: true });
const mods = Object.fromEntries(ORDEM.map((m) => [m, { nodes: [], decl: new Map(), used: new Set(), lets: new Set() }]));
const global = new Map(); // nome -> módulo
for (const n of ast.body) {
  const m = dono[n.loc.start.line];
  if (dono[n.loc.end.line] !== m) erro(`nó na linha ${n.loc.start.line} atravessa ${m} → ${dono[n.loc.end.line]}`);
  mods[m].nodes.push(n);
  const nomes = n.type === 'FunctionDeclaration' ? [n.id.name]
    : n.type === 'VariableDeclaration' ? n.declarations.map((d) => { if (d.id.type !== 'Identifier') erro('desestruturação no topo'); return d.id.name; }) : [];
  for (const x of nomes) {
    if (global.has(x)) erro(`nome duplicado no topo: ${x} (${global.get(x)} e ${m})`);
    global.set(x, m); mods[m].decl.set(x, n);
    if (n.type === 'VariableDeclaration' && n.kind !== 'const') mods[m].lets.add(x);
  }
}

// referências (ignora chaves de objeto e propriedades não computadas)
const reatrib = []; // {mod, nome, node}
for (const [m, M] of Object.entries(mods)) for (const n of M.nodes) {
  walk.fullAncestor(n, (node, _st, anc) => {
    if (node.type !== 'Identifier') return;
    const p = anc[anc.length - 2];
    if (p) {
      if (p.type === 'MemberExpression' && p.property === node && !p.computed) return;
      if ((p.type === 'Property' || p.type === 'PropertyDefinition' || p.type === 'MethodDefinition') && p.key === node && !p.computed && !p.shorthand) return;
      if ((p.type === 'LabeledStatement' || p.type === 'BreakStatement' || p.type === 'ContinueStatement') && p.label === node) return;
    }
    M.used.add(node.name);
    if (p && ((p.type === 'AssignmentExpression' && p.left === node) || (p.type === 'UpdateExpression' && p.argument === node))) {
      const d = global.get(node.name);
      if (d && d !== m) reatrib.push({ mod: m, nome: node.name, p });
    }
  });
}
// reatribuição cruzada só é problema se o nome não for sombreado localmente; o build confirma.
const setters = new Map(); // nome -> dono
for (const r of reatrib) {
  if (!mods[global.get(r.nome)].lets.has(r.nome)) erro(`reatribuição de const ${r.nome} em ${r.mod}`);
  setters.set(r.nome, global.get(r.nome));
}

// handlers inline: identificadores dentro de on*="..." em todo o HTML
const handlerNomes = new Set();
for (const mt of HTML.matchAll(/\son[a-z]+=(["'])([\s\S]*?)\1/g)) {
  for (const id of mt[2].matchAll(/[A-Za-z_$][\w$]*/g)) if (global.has(id[0])) handlerNomes.add(id[0]);
}

// escrita
const rel = (de, para) => { let r = path.relative(path.dirname(de), para).replace(/\\/g, '/'); return r.startsWith('.') ? r : './' + r; };
const relatorio = [];
for (const m of ORDEM) {
  const M = mods[m];
  // texto das faixas, com `export` inserido no início de cada declaração
  const edits = []; // [offset, texto] no JS inteiro
  for (const n of M.nodes) if (n.type === 'FunctionDeclaration' || n.type === 'VariableDeclaration') edits.push([n.start, 'export ']);
  // reatribuições cruzadas → setter
  for (const r of reatrib.filter((x) => x.mod === m)) {
    const p = r.p, S = `__set_${r.nome}`;
    if (p.type === 'AssignmentExpression') {
      const rhs = JS.slice(p.right.start, p.right.end);
      const val = p.operator === '=' ? rhs : `${r.nome} ${p.operator.slice(0, -1)} (${rhs})`;
      edits.push([p.start, { fim: p.end, txt: `${S}(${val})` }]);
    } else {
      edits.push([p.start, { fim: p.end, txt: `${S}(${r.nome} ${p.operator[0]} 1)` }]);
    }
  }
  const partes = [];
  for (const [a, b] of MAPA[m]) {
    const ini = LINES.slice(0, a - 1).reduce((s, l) => s + l.length + 1, 0);
    const fim = ini + LINES.slice(a - 1, b).join('\n').length;
    let txt = JS.slice(ini, fim);
    const es = edits.filter(([o]) => o >= ini && o <= fim).sort((x, y) => y[0] - x[0]);
    for (const [o, e] of es) {
      if (typeof e === 'string') txt = txt.slice(0, o - ini) + e + txt.slice(o - ini);
      else txt = txt.slice(0, o - ini) + e.txt + txt.slice(e.fim - ini);
    }
    partes.push(txt);
  }
  let corpo = partes.join('\n\n');
  if (m === 'main.js') corpo = corpo.replace(/^export /gm, '');
  // setters exportados pelo dono
  const meus = [...setters].filter(([, d]) => d === m).map(([n]) => n);
  if (meus.length) corpo += '\n\n/* setters: outros módulos não podem reatribuir um binding importado */\n'
    + meus.map((n) => `export function __set_${n}(v){ ${n}=v; return v; }`).join('\n') + '\n';
  // imports
  const porFonte = new Map();
  const precisa = new Set([...M.used].filter((x) => global.has(x) && global.get(x) !== m));
  for (const r of reatrib.filter((x) => x.mod === m)) precisa.add(`__set_${r.nome}`);
  for (const x of precisa) {
    const f = x.startsWith('__set_') ? setters.get(x.slice(6)) : global.get(x);
    if (!porFonte.has(f)) porFonte.set(f, new Set());
    porFonte.get(f).add(x);
  }
  const imps = [...porFonte].sort((a, b) => ORDEM.indexOf(a[0]) - ORDEM.indexOf(b[0]))
    .map(([f, s]) => `import { ${[...s].sort().join(', ')} } from '${rel(m, f)}';`).join('\n');
  let cab = `// ${m} — gerado a partir do monólito; edite aqui a partir de agora.\n`;
  if (m === 'main.js') {
    cab += "import './styles.css';\n" + ORDEM.filter((x) => x !== 'main.js').map((x) => `import './${x}';`).join('\n') + '\n';
    const hn = [...handlerNomes].sort();
    const hs = new Map();
    for (const x of hn) { const f = global.get(x); if (!hs.has(f)) hs.set(f, []); hs.get(f).push(x); }
    cab += [...hs].map(([f, s]) => `import { ${s.join(', ')} } from '${rel(m, f)}';`).join('\n') + '\n';
    cab += ORDEM.filter((x) => x !== 'main.js').map((x, i) => `import * as ns${i} from './${x}';`).join('\n') + '\n';
    cab += `\n/* Ponte para handlers inline (onclick="..."): em módulo ES nada é global por padrão.\n   Lista gerada varrendo todos os atributos on* do HTML e dos templates. */\n`;
    cab += `Object.assign(window, { ${hn.join(', ')} });\n`;
    cab += `\n/* Console/depuração/testes: leitura AO VIVO de qualquer export (namespace é live binding). */\n`;
    cab += `const __ns = [${ORDEM.filter((x) => x !== 'main.js').map((_, i) => 'ns' + i).join(', ')}];\n`;
    cab += `window.__planner = new Proxy({}, { get: (_, k) => { for (const n of __ns) if (k in n) return n[k]; } });\n`;
  }
  const final = cab + (imps ? imps + '\n' : '') + '\n' + corpo.trim() + '\n';
  fs.mkdirSync(path.join(OUT, path.dirname(m)), { recursive: true });
  fs.writeFileSync(path.join(OUT, m), final);
  relatorio.push({ m, linhas: final.split('\n').length, exporta: M.decl.size, importa: precisa.size });
}

// CSS e HTML
const css = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync(path.join(OUT, 'styles.css'), css.trim() + '\n');
let html = HTML.replace(/<style>[\s\S]*?<\/style>/, '').replace(HTML.slice(i0, i1 + 9), '<script type="module" src="/src/main.js"></script>');
fs.writeFileSync(path.join(OUT, '..', 'index.html'), html);

console.table(relatorio);
console.log('setters gerados:', [...setters].map(([n, d]) => `${n}@${d}`).join(', ') || 'nenhum');
console.log('funções publicadas em window:', handlerNomes.size);
