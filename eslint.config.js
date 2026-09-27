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
    },
  },
];
