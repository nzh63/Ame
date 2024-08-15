import type { UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import license from 'rollup-plugin-license';
import log from './LogPlugin.mts';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import builtinModules from 'builtin-modules';

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    ...builtinModules
];

export default ({ mode } = { mode: 'production' }) => ({
    optimizeDeps: {
        entries: [
            path.join(import.meta.dirname, '../src/render/MainWindow.html'),
            path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
            path.join(import.meta.dirname, '../src/render/OcrGuide.html')
        ],
        include: [
            'vue',
            'vue-router',
            'tdesign-vue-next',
            'tdesign-icons-vue-next',
            'debug',
            'uuid'
        ]
    },
    mode,
    root: path.join(import.meta.dirname, '../src/render'),
    base: './',
    clearScreen: false,
    plugins: [log({
        include: [
            path.join(import.meta.dirname, '../src/render/*.*').replace(/\\/g, '/'),
            path.join(import.meta.dirname, '../src/render/**/*.*').replace(/\\/g, '/')
        ],
        loggerPath: '@render/logger',
        logFunction: { logger: 'logger' },
        disableLog: mode === 'production'
    }),
    vue(),
    Components({
        dts: true,
        resolvers: [TDesignResolver({ library: 'vue-next', resolveIcons: true })]
    }),
    nodeResolve({ extensions: ['.js', '.ts', '.node'], browser: true }),
    mode === 'production'
        ? license({
            thirdParty: {
                includePrivate: false,
                output: {
                    file: path.join(import.meta.dirname, '../dist/license.dependencies.render.json'),
                    template(dependencies) {
                        return JSON.stringify(dependencies);
                    }
                }
            }
        })
        : null
    ],
    build: {
        outDir: path.join(import.meta.dirname, '../dist/render'),
        emptyOutDir: true,
        minify: mode === 'production',
        sourcemap: mode !== 'production',
        target: 'es2020',
        rollupOptions: {
            input: [
                path.join(import.meta.dirname, '../src/render/MainWindow.html'),
                path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
                path.join(import.meta.dirname, '../src/render/OcrGuide.html')
            ],
            external: externalPackages
        }
    },
    resolve: {
        alias: {
            '@main': path.join(import.meta.dirname, '../src/main'),
            '@render': path.join(import.meta.dirname, '../src/render'),
            '@static': path.join(import.meta.dirname, '../static'),
            '@assets': path.join(import.meta.dirname, '../assets')
        }
    }
}) as UserConfig;
