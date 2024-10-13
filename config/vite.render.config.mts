import type { UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import license from 'rollup-plugin-license';
import log from './LogPlugin.mts';
import renderResolver from './RenderResolver.mjs';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';

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
        ],
        exclude: ['sharp']
    },
    mode,
    root: path.join(import.meta.dirname, '../src/render'),
    base: './',
    clearScreen: false,
    define: {
        'import.meta.env.DEV': JSON.stringify(mode !== 'production'),
        'import.meta.env.PROD': JSON.stringify(mode === 'production'),
        'import.meta.env.IS_MAIN_PROCESS': JSON.stringify(false),
        'import.meta.env.IS_RENDER_PROCESS': JSON.stringify(true),
        'import.meta.env.IS_WORKER_PROCESS': JSON.stringify(false)
    },
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
    renderResolver(),
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
        target: 'chrome120',
        rollupOptions: {
            input: [
                path.join(import.meta.dirname, '../src/render/MainWindow.html'),
                path.join(import.meta.dirname, '../src/render/TranslatorWindow.html'),
                path.join(import.meta.dirname, '../src/render/OcrGuide.html')
            ],
            // external: externalPackages,
            treeshake: 'recommended'
        }
    },
    resolve: {
        alias: {
            '@render': path.join(import.meta.dirname, '../src/render'),
            '@remote': path.join(import.meta.dirname, '../src/remote'),
            '@static': path.join(import.meta.dirname, '../static'),
            '@assets': path.join(import.meta.dirname, '../assets')
        }
    }
}) as UserConfig;
