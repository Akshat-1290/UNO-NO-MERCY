import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const enablePerfTracker =
    env.VITE_ENABLE_PERF_TRACKER ??
    env.ENABLE_PERF_TRACKER ??
    process.env.VITE_ENABLE_PERF_TRACKER ??
    process.env.ENABLE_PERF_TRACKER ??
    'false';

  return {
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
    define: {
      'import.meta.env.VITE_ENABLE_PERF_TRACKER': JSON.stringify(enablePerfTracker),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('gsap')) {
                return 'vendor-gsap';
              }
              if (id.includes('motion') || id.includes('framer-motion') || id.includes('canvas-confetti')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
            }
            if (id.includes('/src/utils/unoDeck') || id.includes('/src/utils/gameEventQueue')) {
              return 'game-logic';
            }
            if (
              id.includes('/src/components/flight/') ||
              id.includes('/src/components/CardDealFlight') ||
              id.includes('/src/utils/sound') ||
              id.includes('/src/utils/haptics')
            ) {
              return 'game-fx';
            }
          },
        },
      },
    },
  };
});