import type { RollupOptions } from 'rollup';
import path from 'path';
import glob from 'glob';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import esbuild from 'rollup-plugin-esbuild';
import log from './LogPlugin';

import builtinModules from 'builtin-modules/static';
import { dependencies } from '../package.json';

const resolve = nodeResolve({ extensions: ['.js', '.ts'], browser: false, exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'] });
const testEntries = glob.sync(path.join(__dirname, '../test') + '/**/*.spec.ts');

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    'mocha',
    ...builtinModules,
    ...Object.keys(dependencies)
];

export default (mode = 'production') => ({
    plugins: [
        log({
            include: [
                path.join(__dirname, '../src/main/*.*').replace(/\\/g, '/'),
                path.join(__dirname, '../src/main/**/*.*').replace(/\\/g, '/')
            ],
            loggerPath: '@main/logger',
            logFunction: { logger: 'logger' },
            disableLog: true
        }),
        alias({
            customResolver: resolve as any,
            entries: {
                '@main': path.join(__dirname, '../src/main'),
                '@render': path.join(__dirname, '../src/render'),
                '@static': path.join(__dirname, '../static'),
                '@assets': path.join(__dirname, '../assets')
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
        commonjs()],
    input: testEntries,
    output: {
        dir: path.join(__dirname, '../dist/test'),
        entryFileNames: '[name].js',
        assetFileNames: '[name].[hash].js',
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
