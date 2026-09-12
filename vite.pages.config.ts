import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  root: 'pages',
  base: '/qingjournal/',
  publicDir: '../public',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: '../dist-pages', emptyOutDir: true, sourcemap: false },
});
