import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173, // Riportiamo il frontend sulla sua porta classica di BrickMarket
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true // Abilita il supporto ai WebSocket per le aste live e la Skill Zone
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});