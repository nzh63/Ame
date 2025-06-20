import log from './LogPlugin.mts';
import native from './NativePlugin.mts';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
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

export default (mode = 'production') =>
  ({
    plugins: [
      log({
        include: [
          path.join(import.meta.dirname, '../src/main/*.*').replace(/\\/g, '/'),
          path.join(import.meta.dirname, '../src/main/**/*.*').replace(/\\/g, '/'),
        ],
        loggerPath: '@main/logger',
        logFunction: { logger: 'logger' },
        disableLog: false,
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
        minify: mode === 'production',
        sourceMap: mode !== 'production',
        target: 'es2020',
        define: {
          'import.meta.env.DEV': JSON.stringify(mode !== 'production'),
          'import.meta.env.PROD': JSON.stringify(mode === 'production'),
          'import.meta.env.IS_MAIN_PROCESS': JSON.stringify(true),
          'import.meta.env.IS_RENDER_PROCESS': JSON.stringify(false),
          'import.meta.env.IS_WORKER_PROCESS': JSON.stringify(false),
        },
      }),
      resolve,
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
      sourcemap: mode !== 'production',
    },
    external: externalPackages,
    onwarn(e) {
      if (e.code !== 'CIRCULAR_DEPENDENCY' && e.id && !/node_modules/.test(e.id)) {
        console.warn(e.id);
        console.warn(e.message);
      }
    },
  }) satisfies RollupOptions;
