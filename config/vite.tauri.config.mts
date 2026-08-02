import vue from '@vitejs/plugin-vue';
import path from 'path';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// Tauri expects a fixed port in dev; fail if it's taken.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: path.join(import.meta.dirname, '../src/render'),
  base: './',
  clearScreen: false,
  server: {
    port: 9090,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 9091,
        }
      : undefined,
  },
  define: {
    'import.meta.env.LOGGING': JSON.stringify(true),
  },
  plugins: [
    vue(),
    Components({
      dts: true,
      resolvers: [TDesignResolver({ library: 'vue-next', resolveIcons: true })],
    }),
  ],
  resolve: {
    alias: [
      { find: '@render', replacement: path.join(import.meta.dirname, '../src/render') },
      { find: '@remote', replacement: path.join(import.meta.dirname, '../src/render/remote') },
      { find: '@main', replacement: path.join(import.meta.dirname, '../src/type/main') },
      { find: '@type', replacement: path.join(import.meta.dirname, '../src/type') },
      { find: '@assets', replacement: path.join(import.meta.dirname, '../assets') },
    ],
  },
  build: {
    outDir: path.join(import.meta.dirname, '../build/render'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        MainWindow: path.join(import.meta.dirname, '../src/render/MainWindow.html'),
        TranslatorWindow: path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
        OcrGuide: path.join(import.meta.dirname, '../src/render/OcrGuide.html'),
      },
    },
  },
});
