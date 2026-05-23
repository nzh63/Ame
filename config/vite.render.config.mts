import log from './LogPlugin.mts';
import renderResolver from './RenderResolver.mjs';
import { defineFlags, resolveFlags } from './build-preset.mts';
import type { Preset } from './build-preset.mts';
import nodeResolve from '@rollup/plugin-node-resolve';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import license from 'rollup-plugin-license';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import type { UserConfig } from 'vite';

export default ({ mode = 'production' }: { mode?: string } = {}) => {
  // Vite's native { mode } doubles as our build preset
  const preset = (mode as Preset) ?? 'production';

  return {
    optimizeDeps: {
      entries: [
        path.join(import.meta.dirname, '../src/render/MainWindow.html'),
        path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
        path.join(import.meta.dirname, '../src/render/OcrGuide.html'),
      ],
      include: ['vue', 'vue-router', 'tdesign-vue-next', 'tdesign-icons-vue-next', 'debug', 'uuid'],
      exclude: ['sharp'],
    },
    mode: preset,
    root: path.join(import.meta.dirname, '../src/render'),
    base: './',
    clearScreen: false,
    define: defineFlags(preset, {
      IS_MAIN_PROCESS: false,
      IS_RENDER_PROCESS: true,
      IS_WORKER_PROCESS: false,
    }),
    plugins: [
      log({
        include: [
          path.join(import.meta.dirname, '../src/render/*.*').replace(/\\/g, '/'),
          path.join(import.meta.dirname, '../src/render/**/*.*').replace(/\\/g, '/'),
        ],
        loggerPath: '@render/logger',
        logFunction: { logger: 'logger' },
        disableLog: !resolveFlags(preset).LOGGING,
      }),
      vue(),
      Components({
        dts: true,
        resolvers: [TDesignResolver({ library: 'vue-next', resolveIcons: true })],
      }),
      renderResolver(),
      nodeResolve({ extensions: ['.js', '.ts', '.node'], browser: true }),
      preset === 'production'
        ? license({
            thirdParty: {
              includePrivate: false,
              output: {
                file: path.join(import.meta.dirname, '../build/license.dependencies.render.json'),
                template(dependencies) {
                  return JSON.stringify(dependencies);
                },
              },
            },
          })
        : null,
    ],
    build: {
      outDir: path.join(import.meta.dirname, '../build/render'),
      emptyOutDir: true,
      minify: preset === 'production',
      sourcemap: preset !== 'production',
      target: 'chrome120',
      rollupOptions: {
        input: [
          path.join(import.meta.dirname, '../src/render/MainWindow.html'),
          path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
          path.join(import.meta.dirname, '../src/render/OcrGuide.html'),
        ],
        // external: externalPackages,
        treeshake: 'recommended',
      },
    },
    resolve: {
      alias: {
        '@render': path.join(import.meta.dirname, '../src/render'),
        '@remote': path.join(import.meta.dirname, '../src/remote'),
        '@assets': path.join(import.meta.dirname, '../assets'),
        '@static': path.join(import.meta.dirname, '../build/static'),
      },
    },
  } satisfies UserConfig;
};
