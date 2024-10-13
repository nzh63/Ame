import {
    getProviderOptionsMeta,
    getProviderOptions,
    setProviderOptions,
    getManagerOptionsMeta,
    getManagerOptions,
    setManagerOptions,
    getExtractorOptionsMeta,
    getExtractorOptions,
    setExtractorOptions
} from '@remote';
import { createRouter, createWebHashHistory } from 'vue-router';

export default createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/dashboard',
            component: () => import('@render/views/Dashboard.vue')
        },
        {
            path: '/add-game',
            component: () => import('@render/views/AddGame.vue')
        },
        {
            path: '/options/locale-changers',
            component: () => import('@render/views/LocaleChangersOptions.vue')
        },
        {
            path: '/options/translate-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getProviderOptionsMeta.bind(globalThis, 'translate'),
                getOptions: getProviderOptions.bind(globalThis, 'translate'),
                setOptions: setProviderOptions.bind(globalThis, 'translate')
            })
        },
        {
            path: '/options/tts-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getManagerOptionsMeta.bind(globalThis, 'tts'),
                getOptions: getManagerOptions.bind(globalThis, 'tts'),
                setOptions: setManagerOptions.bind(globalThis, 'tts')
            })
        },
        {
            path: '/options/tts-provider/WebSpeechSynthesisApi',
            component: () => import('@render/views/options/tts-provider/WebSpeechSynthesisApi.vue')
        },
        {
            path: '/options/tts-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getProviderOptionsMeta.bind(globalThis, 'tts'),
                getOptions: getProviderOptions.bind(globalThis, 'tts'),
                setOptions: setProviderOptions.bind(globalThis, 'tts')
            })
        },
        {
            path: '/options/ocr-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getProviderOptionsMeta.bind(globalThis, 'ocr'),
                getOptions: getProviderOptions.bind(globalThis, 'ocr'),
                setOptions: setProviderOptions.bind(globalThis, 'ocr')
            })
        },
        {
            path: '/options/ocr-extractor',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getExtractorOptionsMeta.bind(globalThis, 'ocr'),
                getOptions: getExtractorOptions.bind(globalThis, 'ocr'),
                setOptions: setExtractorOptions.bind(globalThis, 'ocr')
            })
        },
        {
            path: '/options/segment-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getManagerOptionsMeta.bind(globalThis, 'segment'),
                getOptions: getManagerOptions.bind(globalThis, 'segment'),
                setOptions: setManagerOptions.bind(globalThis, 'segment')
            })
        },
        {
            path: '/options/segment-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getProviderOptionsMeta.bind(globalThis, 'segment'),
                getOptions: getProviderOptions.bind(globalThis, 'segment'),
                setOptions: setProviderOptions.bind(globalThis, 'segment')
            })
        },
        {
            path: '/options/dict-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getManagerOptionsMeta.bind(globalThis, 'dict'),
                getOptions: getManagerOptions.bind(globalThis, 'dict'),
                setOptions: setManagerOptions.bind(globalThis, 'dict')
            })
        },
        {
            path: '/options/dict-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getProviderOptionsMeta.bind(globalThis, 'dict'),
                getOptions: getProviderOptions.bind(globalThis, 'dict'),
                setOptions: setProviderOptions.bind(globalThis, 'dict')
            })
        },
        {
            path: '/',
            redirect: '/dashboard'
        }
    ]
});
