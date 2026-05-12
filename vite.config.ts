import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'logo-192x192.png', 'logo-512x512.png', 'maskable-512x512.png'],
      manifest: {
        id: '/',
        name: 'DecoStats',
        short_name: 'DecoStats',
        description: 'Sports Analytics & Data — Estatísticas ao vivo, bilhetes automatizados e relatórios técnicos com IA.',
        lang: 'pt-BR',
        theme_color: '#00E5FF',
        background_color: '#0A0A0F',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        categories: ['sports', 'entertainment', 'utilities'],
        icons: [
          {
            src: '/logo-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'DecoStats Dashboard'
          },
          {
            src: '/screenshot-narrow.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'DecoStats Mobile'
          }
        ],
        shortcuts: [
          {
            name: 'Jogos Ao Vivo',
            short_name: 'Ao Vivo',
            url: '/lobby',
            icons: [{ src: '/logo-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Bilhetes',
            short_name: 'Bilhetes',
            url: '/bilhetes',
            icons: [{ src: '/logo-192x192.png', sizes: '192x192' }]
          }
        ],
        launch_handler: {
          client_mode: 'navigate-existing'
        },
        prefer_related_applications: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});

