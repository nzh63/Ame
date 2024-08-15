import type { RollupOptions } from 'rollup';
import path from 'path';
import glob from 'glob';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import { wasm } from '@rollup/plugin-wasm';
import esbuild from 'rollup-plugin-esbuild';
import log from './LogPlugin.mts';
import native from './NativePlugin.mts';
import devSpeedup from './DevSpeedupPlugin.mts';

import builtinModules from 'builtin-modules';
import packageJson from '../package.json' with {type: 'json'};

const resolve = nodeResolve({ extensions: ['.js', '.ts'], browser: false, exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'] });
const testEntries = glob.sync(path.join(import.meta.dirname, '../test') + '/**/*.spec.ts');

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    'mocha',
    ...builtinModules,
    ...Object.keys(packageJson.dependencies)
];

export default (mode = 'production') => ({
    plugins: [
        log({
            include: [
                path.join(import.meta.dirname, '../src/main/*.*').replace(/\\/g, '/'),
                path.join(import.meta.dirname, '../src/main/**/*.*').replace(/\\/g, '/')
            ],
            loggerPath: '@main/logger',
            logFunction: { logger: 'logger' },
            disableLog: false
        }),
        mode === 'development' ? devSpeedup() : null,
        alias({
            customResolver: resolve as any,
            entries: {
                '@main': path.join(import.meta.dirname, '../src/main'),
                '@render': path.join(import.meta.dirname, '../src/render'),
                '@static': path.join(import.meta.dirname, '../static'),
                '@assets': path.join(import.meta.dirname, '../assets')
            }
        }),
        esbuild({
            minify: mode === 'production',
            sourceMap: mode !== 'production',
            target: 'es2020',
            define: {
                'import.meta.env.DEV': JSON.stringify(mode !== 'production'),
                'import.meta.env.PROD': JSON.stringify(mode === 'production')
            }
        }),
        resolve,
        json(),
        wasm(),
        native(),
        commonjs()],
    input: testEntries,
    output: {
        dir: path.join(import.meta.dirname, '../dist/test'),
        entryFileNames: '[name].js',
        format: 'commonjs',
        sourcemap: mode !== 'production'
    },
    external: externalPackages,
    onwarn(e) {
        if (e.code !== 'CIRCULAR_DEPENDENCY' && e.id && !/node_modules/.test(e.id)) {
            console.warn(e.id);
            console.warn(e.message);
        }
    }
} as RollupOptions);
