import type { RollupOptions } from 'rollup';
import path from 'path';
import glob from 'glob';
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

const resolve = nodeResolve({ extensions: ['.js', '.ts'], browser: false, exportConditions: ['import', 'module', 'node', 'require', 'files', 'default'] });
const workerEntries = glob.sync(path.join(import.meta.dirname, '../src/workers') + '/*/index.ts').map(i => i.replace(/\\/g, '/'));

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    'tesseract.js-core',
    ...builtinModules
];

export default (mode = 'production') => ({
    plugins: [
        log({
            include: [
                path.join(import.meta.dirname, '../src/workers/*.*').replace(/\\/g, '/'),
                path.join(import.meta.dirname, '../src/workers/**/*.*').replace(/\\/g, '/')
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
                'import.meta.env.IS_MAIN_PROCESS': JSON.stringify(false),
                'import.meta.env.IS_RENDER_PROCESS': JSON.stringify(false),
                'import.meta.env.IS_WORKER_PROCESS': JSON.stringify(true)
            }
        }),
        resolve,
        json(),
        wasm(),
        native(),
        commonjs(),
        copy({
            targets: [{
                src: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm',
                dest: path.join(import.meta.dirname, '../dist/workers')
            }]
        }),
        mode === 'production'
            ? license({
                thirdParty: {
                    includePrivate: false,
                    output: {
                        file: path.join(import.meta.dirname, '../dist/license.dependencies.workers.json'),
                        template(dependencies: any) {
                            return JSON.stringify(dependencies);
                        }
                    }
                }
            })
            : null
    ],
    input: workerEntries,
    output: {
        dir: path.join(import.meta.dirname, '../dist/workers'),
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
