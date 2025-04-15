// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // Nastavení root adresáře, aby Vite věděl, že index.html a src jsou v /renderer
  root: path.resolve(__dirname, 'renderer'),

  // Base se často dává './' pro Electron, aby vše bylo relativní
  base: './',

  build: {
    // Výstup půjde do dist/renderer
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
})
