// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

const RELAY = `localhost:${process.env.SHAAM_PORT ?? 4401}`

export default defineConfig({
  output: 'static', // every page is client-driven; the relay owns all party and game state
  server: { port: 4400, host: true },
  integrations: [react()],
  vite: {
    // In dev Astro serves pages and forwards the socket and API, so pages always talk to their own origin.
    server: { proxy: { '/ws': { target: `ws://${RELAY}`, ws: true }, '/api': `http://${RELAY}` } },
  },
})
