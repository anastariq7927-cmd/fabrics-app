import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Shares the single .env at the repo root with the microservices.
  envDir: '..',
  server: { port: 5173 },
});
