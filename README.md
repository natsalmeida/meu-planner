# Planner de estudos

App de página única (Firebase RTDB + login Google) para controle de estudos no período letivo, com módulo de finanças independente.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor local com recarga (`http://localhost:5173`) |
| `npm run build` | Gera `dist/index.html`: **um único arquivo** com JS e CSS inline |
| `npm run check` | Lint + e2e + diferencial contra o monólito. Rode antes de todo deploy |

## Deploy

O artefato é o mesmo de antes: um `index.html`. Rode `npm run build` e publique `dist/index.html` onde o arquivo antigo estava. Nada muda na hospedagem, no Firebase ou nas regras.

## Estrutura

```
src/
  main.js              boot + ponte window (handlers inline) + window.__planner
  styles.css
  core/                constantes (folha, sem imports), store, sync, auth, datas, horas
  features/            timer, validação de sessões, prazos, export/diagnóstico
  ui/                  helpers de UI e router
  views/               dashboard, calendário, pendências, diário, grade
    unitins/           hub, aulas, síncronas, entregáveis
    analytics/         gráficos, output (produção/nível), página
    habitos/           hábitos e estante
  financas/            nó próprio no Firebase; não depende do store de estudos
tests/
  e2e.mjs              roda contra dist/: views, handlers, validação, split, sync entre abas
  equivalencia.mjs     renderiza cada tela no monólito e no build e exige HTML idêntico
legacy/                monólito de referência (remover quando o diferencial deixar de ser útil)
tools/migracao/        gerador usado uma única vez; NÃO rodar de novo (sobrescreveria src/)
```

## Regras da casa

- **`core/constantes.js` não importa nada.** O `store` usa as constantes na inicialização. Se esse módulo ganhar um import, pode surgir TDZ em ciclo de dependências.
- **`let` compartilhado só é reatribuído no módulo dono.** Fora dele, use o setter `__set_<nome>` (o build e o `no-import-assign` recusam o contrário).
- **Função chamada por `onclick="..."` precisa estar na ponte em `main.js`.** O `e2e.mjs` varre todos os atributos `on*` renderizados e falha se algum não resolver.
- **Console:** `__planner.store`, `__planner.weekAlloc()` etc. dão leitura ao vivo de qualquer export.

## Dívidas conhecidas

- **Handlers inline + ponte `window` (160 funções).** O próximo passo é delegação de eventos (`data-acao`), tela por tela.
- **Firebase SDK v8 via CDN.** Migrar para o SDK modular v10 via npm permite tree-shaking e remove a dependência do global `firebase`.
- **Código morto herdado:** `picoDia` (dashboard) e `hoje` (hábitos); vários `catch(e)` sem uso.
