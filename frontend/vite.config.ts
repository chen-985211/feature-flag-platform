import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080';
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/health': apiTarget,
      '/api': apiTarget,
    },
  },
});
