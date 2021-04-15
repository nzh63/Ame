import { defineOCRProvider } from '@main/providers/ocr';

export default defineOCRProvider({
    id: 'test',
    optionsSchema: {},
    defaultOptions: {},
    data() { return null; }
}, {
    init() { },
    isReady() { return import.meta.env.DEV; },
    recognize(img) { return 'こんにちは'; },
    destroy() { }
});
