import log from './LogPlugin.mts';
import native from './NativePlugin.mts';
import type { Preset } from './build-preset.mts';
import { defineFlags, resolveFlags } from './build-preset.mts';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { wasm } from '@rollup/plugin-wasm';
import builtinModules from 'builtin-modules';
import { glob } from 'glob';
import path from 'path';
import type { RollupOptions } from 'rollup';
import copy from 'rollup-plugin-copy';
import esbuild from 'rollup-plugin-esbuild';
import license from 'rollup-plugin-license';

const resolve = nodeResolve({
  extensions: ['.js', '.ts'],
  browser: false,
  exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'],
});
const workerEntries = glob
  .sync(path.join(import.meta.dirname, '../src/workers') + '/*/index.ts')
  .map((i) => i.replace(/\\/g, '/'));

const externalPackages = [
  'electron',
  'electron/main',
  'electron/common',
  'electron/renderer',
  'tesseract.js-core',
  ...builtinModules,
];

export default (preset: Preset = 'production') =>
  ({
    plugins: [
      log({
        include: [
          path.join(import.meta.dirname, '../src/workers/*.*').replace(/\\/g, '/'),
          path.join(import.meta.dirname, '../src/workers/**/*.*').replace(/\\/g, '/'),
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
          IS_MAIN_PROCESS: false,
          IS_RENDER_PROCESS: false,
          IS_WORKER_PROCESS: true,
        }),
      }),
      resolve,
      json(),
      wasm(),
      native(),
      commonjs(),
      copy({
        targets: [
          {
            src: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm',
            dest: path.join(import.meta.dirname, '../build/workers'),
          },
        ],
      }),
      preset === 'production'
        ? license({
            thirdParty: {
              includePrivate: false,
              output: {
                file: path.join(import.meta.dirname, '../build/license.dependencies.workers.json'),
                template(dependencies: any) {
                  return JSON.stringify(dependencies);
                },
              },
            },
          })
        : null,
    ],
    input: workerEntries,
    output: {
      dir: path.join(import.meta.dirname, '../build/workers'),
      entryFileNames: (chunkInfo) => {
        const workerBase = path.join(import.meta.dirname, '../src/workers').replace(/\\/g, '/');
        const facadeModuleId = (chunkInfo.facadeModuleId ?? '').replace(/\\/g, '/');
        if (facadeModuleId.startsWith(workerBase)) {
          const reg = new RegExp(`^${workerBase}/(.*?)/`);
          const workerName = (reg.exec(facadeModuleId) ?? [])[1];
          if (workerName) {
            return `${workerName}.js`;
          }
        }
        return 'index.js';
      },
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
