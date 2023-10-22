import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import glob from 'glob';
import nodeResolve from '@rollup/plugin-node-resolve';
import log from './LogPlugin';
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';

import builtinModules from 'builtin-modules/static';
const license = require('rollup-plugin-license');

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    ...builtinModules
];

const ant = glob.sync('ant-design-vue/es/*/index.js', { cwd: path.join(__dirname, '../node_modules') }).map(i => i.replace(/\/index\.js$/, ''));
const antStyle = glob.sync('ant-design-vue/es/*/style/css.js', { cwd: path.join(__dirname, '../node_modules') }).map(i => i.replace(/\.js$/, ''));
const antIcon = glob.sync('@ant-design/icons-vue/*.js', { cwd: path.join(__dirname, '../node_modules') }).map(i => i.replace(/\.js$/, ''));

// https://vitejs.dev/config/
export default defineConfig(({ mode } = { command: 'build', mode: 'production' }) => ({
    optimizeDeps: {
        entries: [
            path.join(__dirname, '../src/render/MainWindow.html'),
            path.join(__dirname, '../src/render/TranslatorWindow.html'),
            path.join(__dirname, '../src/render/OcrGuide.html')
        ],
        include: [
            'vue',
            'vue-router',
            ...ant,
            ...antStyle,
            ...antIcon,
            'debug',
            'uuid'
        ]
    },
    mode,
    root: path.join(__dirname, '../src/render'),
    base: './',
    clearScreen: false,
    plugins: [log({
        include: [
            path.join(__dirname, '../src/render/*.*').replace(/\\/g, '/'),
            path.join(__dirname, '../src/render/**/*.*').replace(/\\/g, '/')
        ],
        loggerPath: '@render/logger',
        logFunction: { logger: 'logger' },
        disableLog: mode === 'production'
    }),
    vue(),
    Components({ dts: false, resolvers: [AntDesignVueResolver({ importStyle: false, resolveIcons: true })] }),
    nodeResolve({ extensions: ['.js', '.ts', '.node'], browser: true }),
    mode === 'production'
        ? license({
            thirdParty: {
                includePrivate: false,
                output: {
                    file: path.join(__dirname, '../dist/license.dependencies.render.json'),
                    template(dependencies) {
                        return JSON.stringify(dependencies);
                    }
                }
            }
        })
        : null
    ],
    build: {
        outDir: path.join(__dirname, '../dist/render'),
        emptyOutDir: true,
        minify: mode === 'production',
        sourcemap: mode !== 'production',
        target: 'es2020',
        rollupOptions: {
            input: [
                path.join(__dirname, '../src/render/MainWindow.html'),
                path.join(__dirname, '../src/render/TranslatorWindow.html'),
                path.join(__dirname, '../src/render/OcrGuide.html')
            ],
            external: externalPackages
        }
    },
    resolve: {
        alias: {
            '@main': path.join(__dirname, '../src/main'),
            '@render': path.join(__dirname, '../src/render'),
            '@static': path.join(__dirname, '../static'),
            '@assets': path.join(__dirname, '../assets')
        }
    }
}));
