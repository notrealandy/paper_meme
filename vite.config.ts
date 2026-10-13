import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    host: '127.0.0.1',
    hmr: {
      host: '127.0.0.1',
      port: 5173,
      clientPort: 5173,
      protocol: 'ws',
    },
  },
});