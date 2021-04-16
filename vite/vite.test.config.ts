import { defineConfig } from 'vite';
import path from 'path';
import glob from 'glob';
import log from './LogPlugin';

import builtinModules from 'builtin-modules/static';
import { dependencies } from '../package.json';

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    'mocha',
    ...builtinModules,
    ...Object.keys(dependencies)
];

// https://vitejs.dev/config/
export default defineConfig(({ mode } = { command: 'build', mode: 'production' }) => ({
    mode,
    root: path.join(__dirname, '../test'),
    assetsInclude: [/static\//],
    clearScreen: false,
    plugins: [log({
        include: [
            path.join(__dirname, '../src/main/*.*').replace(/\\/g, '/'),
            path.join(__dirname, '../src/main/**/*.*').replace(/\\/g, '/')
        ],
        loggerPath: '@main/logger',
        logFunction: { logger: 'logger' },
        disableLog: true
    })],
    build: {
        target: 'node12',
        outDir: path.join(__dirname, '../dist/test'),
        emptyOutDir: true,
        minify: mode === 'production',
        sourcemap: mode !== 'production',
        rollupOptions: {
            input: glob.sync(path.join(__dirname, '../test') + '/**/*.spec.ts'),
            output: {
                entryFileNames: '[name].js',
                format: 'commonjs'
            },
            external: externalPackages
        }
    },
    resolve: {
        alias: {
            '@main': path.join(__dirname, '../src/main'),
            '@render': path.join(__dirname, '../src/render'),
            '@static': path.join(__dirname, '../static'),
            '@assets': path.join(__dirname, '../assets'),
            debug: path.join(__dirname, '../node_modules/debug/src/node.js'),
            'form-data': path.join(__dirname, '../node_modules/form-data/lib/form_data.js'),
            'supports-color': path.join(__dirname, '../node_modules/supports-color/index.js')
        }
    }
}));
