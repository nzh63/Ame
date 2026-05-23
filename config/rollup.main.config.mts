import log from './LogPlugin.mts';
import native from './NativePlugin.mts';
import { defineFlags, resolveFlags } from './build-preset.mts';
import type { Preset } from './build-preset.mts';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { wasm } from '@rollup/plugin-wasm';
import builtinModules from 'builtin-modules';
import path from 'path';
import type { RollupOptions } from 'rollup';
import copy from 'rollup-plugin-copy';
import esbuild from 'rollup-plugin-esbuild';
import license from 'rollup-plugin-license';

const externalPackages = ['electron', 'electron/main', 'electron/common', 'electron/renderer', ...builtinModules];
const resolve = nodeResolve({
  extensions: ['.js', '.ts'],
  browser: false,
  exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'],
});

export default (preset: Preset = 'production') =>
  ({
    plugins: [
      log({
        include: [
          path.join(import.meta.dirname, '../src/main/*.*').replace(/\\/g, '/'),
          path.join(import.meta.dirname, '../src/main/**/*.*').replace(/\\/g, '/'),
        ],
        loggerPath: '@main/logger',
        logFunction: { logger: 'logger' },
        disableLog: !resolveFlags(preset).LOGGING,
      }),
      alias({
        customResolver: resolve as any,
        entries: {
          '@main': path.join(import.meta.dirname, '../src/main'),
          '@render': path.join(import.meta.dirname, '../src/render'),
          '@remote': path.join(import.meta.dirname, '../src/remote'),
          '@assets': path.join(import.meta.dirname, '../assets'),
          '@static': path.join(import.meta.dirname, '../build/static'),
        },
      }),
      esbuild({
        minify: preset === 'production',
        sourceMap: preset !== 'production',
        target: 'es2020',
        define: defineFlags(preset, {
          IS_MAIN_PROCESS: true,
          IS_RENDER_PROCESS: false,
          IS_WORKER_PROCESS: false,
        }),
      }),
      resolve,
      json(),
      wasm(),
      native(),
      commonjs({ ignoreDynamicRequires: true }),
      copy({
        targets: [
          {
            src: [`node_modules/@img/sharp-${process.platform}-${process.env.npm_config_arch}/lib/*`],
            dest: path.join(import.meta.dirname, '../build/src/build/Release'),
          },
        ],
      }),
      preset === 'production'
        ? license({
            thirdParty: {
              includePrivate: false,
              output: {
                file: path.join(import.meta.dirname, '../build/license.dependencies.main.json'),
                template(dependencies: any) {
                  return JSON.stringify(dependencies);
                },
              },
            },
          })
        : null,
    ],
    input: path.join(
      import.meta.dirname,
      preset === 'development' ? '../src/main/index.dev.ts' : '../src/main/index.ts',
    ),
    output: {
      dir: path.join(import.meta.dirname, '../build/main'),
      entryFileNames: 'index.js',
      chunkFileNames: 'chunk-[hash].js',
      // manualChunks(id, meta) {
      //     if (id.includes('node_modules\\conf')) {
      //         return 'conf';
      //     }
      //     if (id.includes('node_modules')) {
      //         return 'vendor';
      //     }
      // },
      format: 'commonjs',
      sourcemap: preset !== 'production',
    },
    external: externalPackages,
    onwarn(e) {
      if (e.code !== 'CIRCULAR_DEPENDENCY' && e.id && !/node_modules/.test(e.id)) {
        console.warn(e.id);
        console.warn(e.message);
      }
    },
  }) satisfies RollupOptions;
