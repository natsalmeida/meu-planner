/* Remove imports não usados apontados pelo ESLint (análise de escopo real, que o
   gerador não faz: pega nomes sombreados e alvos de atribuição que viraram setter). */
import { ESLint } from 'eslint';
import fs from 'fs';
const eslint = new ESLint({ overrideConfig: { rules: { 'no-unused-vars': ['warn', { vars: 'all', args: 'none', caughtErrors: 'none' }] } } });
const res = await eslint.lintFiles(['src/**/*.js']);
let n = 0;
for (const r of res) {
  const linhas = fs.readFileSync(r.filePath, 'utf8').split('\n');
  const mortos = r.messages.filter((m) => m.ruleId === 'no-unused-vars' && /^import /.test(linhas[m.line - 1]));
  if (!mortos.length) continue;
  for (const m of mortos) {
    const nome = m.message.match(/'([^']+)'/)[1];
    linhas[m.line - 1] = linhas[m.line - 1].replace(new RegExp(`\\b${nome}\\b,?\\s*`), '').replace(/,\s*}/, ' }');
    n++;
  }
  const limpo = linhas.filter((l) => !/^import \{\s*\} from/.test(l));
  fs.writeFileSync(r.filePath, limpo.join('\n'));
}
console.log(`imports podados: ${n}`);
