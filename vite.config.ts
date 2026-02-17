
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/maechaem_DB/', // สำคัญมาก: ต้องตรงกับชื่อ Repository ของคุณ
  server: {
    host: true, // Listen on all addresses
    port: 8080,
  },
  preview: {
    host: true, // Listen on all addresses for preview/production
    port: 8080,
    allowedHosts: true
  }
});
