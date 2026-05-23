import log from './LogPlugin.mts';
import native from './NativePlugin.mts';
import type { Preset } from './build-preset.mts';
import { defineFlags, resolveFlags } from './build-preset.mts';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import image from '@rollup/plugin-image';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { wasm } from '@rollup/plugin-wasm';
import builtinModules from 'builtin-modules';
import { glob } from 'glob';
import path from 'path';
import type { RollupOptions } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

const resolve = nodeResolve({
  extensions: ['.js', '.ts'],
  browser: false,
  exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'],
});
const testEntries = glob.sync(path.join(import.meta.dirname, '../test') + '/**/*.spec.ts');

const externalPackages = [
  'electron',
  'electron/main',
  'electron/common',
  'electron/renderer',
  'mocha',
  ...builtinModules,
];

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
      image(),
      json(),
      wasm(),
      native(),
      commonjs({
        dynamicRequireRoot: path.join(import.meta.dirname, '../build/test'),
        dynamicRequireTargets: ['../build/Release/*.node'],
        ignoreDynamicRequires: true,
      }),
    ],
    input: testEntries,
    output: {
      dir: path.join(import.meta.dirname, '../build/test'),
      entryFileNames: '[name].js',
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
