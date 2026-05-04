import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  base: '/sillytavern-cardforge/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        chunkFileNames: (chunkInfo) => {
          const name = (chunkInfo.name || 'chunk').replace(/^_+/, '');
          return `assets/${name}-[hash].js`;
        },
        entryFileNames: (chunkInfo) => {
          const name = (chunkInfo.name || 'entry').replace(/^_+/, '');
          return `assets/${name}-[hash].js`;
        }
      }
    }
  },
  server: {
    port: 5174
  }
});
