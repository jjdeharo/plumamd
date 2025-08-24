import { defineConfig } from 'vite'
import pkg from './package.json' assert { type: 'json' }

export default defineConfig({
  // Rutas relativas para funcionar bajo /<usuario>.github.io/<repo>/
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
  }
})
