import { defineTranslateProvider } from '@main/providers/translate';

export default defineTranslateProvider({
    id: 'echo',
    optionsSchema: {},
    defaultOptions: {},
    data() { return null; }
}, {
    init() { },
    isReady() { return import.meta.env.DEV; },
    translate(t) { return t; },
    destroy() { }
});
