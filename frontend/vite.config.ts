import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Proxies HTTP API requests to backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxies WebSocket connections
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});