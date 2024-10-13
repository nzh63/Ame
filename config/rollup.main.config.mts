import type { RollupOptions } from 'rollup';
import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import { wasm } from '@rollup/plugin-wasm';
import esbuild from 'rollup-plugin-esbuild';
import copy from 'rollup-plugin-copy';
import license from 'rollup-plugin-license';
import log from './LogPlugin.mts';
import native from './NativePlugin.mts';

import builtinModules from 'builtin-modules';

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    ...builtinModules
];
const resolve = nodeResolve({ extensions: ['.js', '.ts'], browser: false, exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'] });

export default (mode = 'production') => ({
    plugins: [
        log({
            include: [
                path.join(import.meta.dirname, '../src/main/*.*').replace(/\\/g, '/'),
                path.join(import.meta.dirname, '../src/main/**/*.*').replace(/\\/g, '/')
            ],
            loggerPath: '@main/logger',
            logFunction: { logger: 'logger' },
            disableLog: mode === 'production'
        }),
        alias({
            customResolver: resolve as any,
            entries: {
                '@main': path.join(import.meta.dirname, '../src/main'),
                '@render': path.join(import.meta.dirname, '../src/render'),
                '@remote': path.join(import.meta.dirname, '../src/remote'),
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
                'import.meta.env.PROD': JSON.stringify(mode === 'production'),
                'import.meta.env.IS_MAIN_PROCESS': JSON.stringify(true),
                'import.meta.env.IS_RENDER_PROCESS': JSON.stringify(false),
                'import.meta.env.IS_WORKER_PROCESS': JSON.stringify(false)
            }
        }),
        resolve,
        json(),
        wasm(),
        native(),
        commonjs({ ignoreDynamicRequires: true }),
        copy({
            targets: [{
                src: [
                    'node_modules/sharp/build/Release/*.node',
                    'node_modules/sharp/build/Release/*.dll'
                ],
                dest: path.join(import.meta.dirname, '../dist/build/Release')
            }]
        }),
        mode === 'production'
            ? license({
                thirdParty: {
                    includePrivate: false,
                    output: {
                        file: path.join(import.meta.dirname, '../dist/license.dependencies.main.json'),
                        template(dependencies: any) {
                            return JSON.stringify(dependencies);
                        }
                    }
                }
            })
            : null
    ],
    input: path.join(import.meta.dirname, mode === 'production' ? '../src/main/index.ts' : '../src/main/index.dev.ts'),
    output: {
        dir: path.join(import.meta.dirname, '../dist/main'),
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
