import { defineConfig } from 'vite';
import path from 'path';
import log from './LogPlugin';

import builtinModules from 'builtin-modules/static';
import { dependencies } from '../package.json';

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    ...builtinModules,
    ...Object.keys(dependencies)
];

// https://vitejs.dev/config/
export default defineConfig(({ mode } = { command: 'build', mode: 'production' }) => ({
    optimizeDeps: { entries: path.join(__dirname, '../src/main/index.ts') },
    mode,
    root: path.join(__dirname, '../src/main'),
    assetsInclude: [/static\//],
    clearScreen: false,
    plugins: [log({
        include: [
            path.join(__dirname, '../src/main/*.*').replace(/\\/g, '/'),
            path.join(__dirname, '../src/main/**/*.*').replace(/\\/g, '/')
        ],
        loggerPath: '@main/logger',
        logFunction: { logger: 'logger' },
        disableLog: mode === 'production'
    })],
    build: {
        target: 'node12',
        outDir: path.join(__dirname, '../dist/main'),
        emptyOutDir: true,
        minify: mode === 'production',
        sourcemap: mode !== 'production',
        rollupOptions: {
            input: path.join(__dirname, mode === 'production' ? '../src/main/index.ts' : '../src/main/index.dev.ts'),
            output: {
                entryFileNames: 'index.js',
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
            debug: path.join(__dirname, '../node_modules/debug/src/node.js'),
            'form-data': path.join(__dirname, '../node_modules/form-data/lib/form_data.js'),
            'supports-color': path.join(__dirname, '../node_modules/supports-color/index.js')
        }
    }
}));
