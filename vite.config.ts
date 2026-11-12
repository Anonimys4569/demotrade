import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 npm run build  -> один index.html (зручно відкрити на ПК подвійним кліком)
export default defineConfig({
  base: './',
  // іконки монет вшиваємо в код, щоб вони завжди були доступні без інтернету
  build: { assetsInlineLimit: 200000 },
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
});
