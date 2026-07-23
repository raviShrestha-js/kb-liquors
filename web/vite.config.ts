import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'KB Liquors — Stock & POS',
      short_name: 'KB Liquors',
      description: 'Stock management and point of sale for KB Liquors',
      theme_color: '#17140d',
      background_color: '#f6f3ea',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.href.includes('.supabase.co/rest/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-api',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
          },
        },
        {
          urlPattern: ({ url }) => url.href.includes('.supabase.co/storage/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'supabase-photos',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
    },
  }), cloudflare()],
})