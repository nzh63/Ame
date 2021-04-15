import {
    getTranslateProviderOptionsMeta,
    getTranslateProviderOptions,
    setTranslateProviderOptions,
    getTTSProviderOptionsMeta,
    getTTSProviderOptions,
    setTTSProviderOptions,
    getTTSManagerOptionsMeta,
    getTTSManagerOptions,
    setTTSManagerOptions,
    getOCRProviderOptionsMeta,
    getOCRProviderOptions,
    setOCRProviderOptions
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
            path: '/options/tts-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getTTSProviderOptionsMeta,
                getOptions: getTTSProviderOptions,
                setOptions: setTTSProviderOptions
            })
        },
        {
            path: '/options/tts-manager',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: '<none>',
                getMeta: getTTSManagerOptionsMeta,
                getOptions: getTTSManagerOptions,
                setOptions: setTTSManagerOptions
            })
        },
        {
            path: '/options/ocr-provider/:providerId',
            component: () => import('@render/views/Options.vue'),
            props: route => ({
                providerId: route.params.providerId,
                getMeta: getOCRProviderOptionsMeta,
                getOptions: getOCRProviderOptions,
                setOptions: setOCRProviderOptions
            })
        },
        {
            path: '/',
            redirect: '/dashboard'
        }
    ]
});
