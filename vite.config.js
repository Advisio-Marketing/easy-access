// vite.config.js
import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Kořenový adresář pro Vite (kde je index.html a src)
  root: path.resolve(__dirname, 'renderer'),
  // Relativní cesty pro build, důležité pro Electron
  base: './',
  // Kam Vite uloží build rendereru (relativně ke kořeni projektu)
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  // Port pro dev server
  server: {
    port: 5173,
    // Přidáno 'host: true', aby byl server dostupný i mimo localhost (pro Electron)
    host: true,
    strictPort: true, // Zajistí, že se použije tento port
  },
  // Optimalizace (může být potřeba později)
  // optimizeDeps: {
  //   include: ['electron-log', 'electron-updater'] // Pokud by byly problémy s require v rendereru
  // }
})