import {
    getTranslateProviderOptionsMeta,
    getTranslateProviderOptions,
    setTranslateProviderOptions,
    getTtsProviderOptionsMeta,
    getTtsProviderOptions,
    setTtsProviderOptions,
    getTtsManagerOptionsMeta,
    getTtsManagerOptions,
    setTtsManagerOptions,
    getOcrProviderOptionsMeta,
    getOcrProviderOptions,
    setOcrProviderOptions,
    getOcrExtractorOptions,
    getOcrExtractorOptionsMeta,
    setOcrExtractorOptions,
    getSegmentProviderOptionsMeta,
    getSegmentProviderOptions,
    setSegmentProviderOptions,
    getSegmentManagerOptionsMeta,
    getSegmentManagerOptions,
    setSegmentManagerOptions
} from '@render/remote';
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
                getMeta: getTranslateProviderOptionsMeta,
                getOptions: getTranslateProviderOptions,
                setOptions: setTranslateProviderOptions
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
                getMeta: getTtsProviderOptionsMeta,
                getOptions: getTtsProviderOptions,
                setOptions: setTtsProviderOptions
            })
        },
        {
            path: '/options/tts-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getTtsManagerOptionsMeta,
                getOptions: getTtsManagerOptions,
                setOptions: setTtsManagerOptions
            })
        },
        {
            path: '/options/ocr-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getOcrProviderOptionsMeta,
                getOptions: getOcrProviderOptions,
                setOptions: setOcrProviderOptions
            })
        },
        {
            path: '/options/ocr-extractor',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getOcrExtractorOptionsMeta,
                getOptions: getOcrExtractorOptions,
                setOptions: setOcrExtractorOptions
            })
        },
        {
            path: '/options/segment-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getSegmentManagerOptionsMeta,
                getOptions: getSegmentManagerOptions,
                setOptions: setSegmentManagerOptions
            })
        },
        {
            path: '/options/segment-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getSegmentProviderOptionsMeta,
                getOptions: getSegmentProviderOptions,
                setOptions: setSegmentProviderOptions
            })
        },
        {
            path: '/',
            redirect: '/dashboard'
        }
    ]
});
