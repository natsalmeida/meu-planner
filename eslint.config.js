import globals from 'globals';
export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: { ...globals.browser, firebase: 'readonly' }, // SDK v8 via CDN (script clássico)
    },
    rules: {
      'no-undef': 'error',            // import faltando ou global implícito (strict mode quebraria)
      'no-import-assign': 'error',    // reatribuição de binding importado
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'warn',
      // regra 6: chave de dia nunca via toISOString (UTC vira o dia seguinte após 21h em UTC-3).
      // 'warn' até varrer os usos restantes; uso legítimo (timestamp completo) leva
      // eslint-disable-next-line com justificativa. Depois disso, subir para 'error'.
      'no-restricted-properties': ['warn', { property: 'toISOString',
        message: 'Chave de dia: use todayISO/localISO/weekKey (fuso America/Sao_Paulo).' }],
    },
  },
];
