import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/* Build = um único index.html com JS e CSS inline: o artefato de deploy continua
   igual ao de hoje (um arquivo), então a hospedagem não muda. */
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist', emptyOutDir: true, minify: 'esbuild', sourcemap: false },
});
