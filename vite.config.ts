import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { studioApi } from './server/studioApi'

export default defineConfig({
  plugins: [react(), tailwindcss(), studioApi()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/catalog.json')) return 'catalog-data'
          if (id.includes('/src/data/taxonomy.v2.json')) return 'taxonomy-data'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
