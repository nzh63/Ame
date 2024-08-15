import { createApp } from 'vue';

import router from '@render/router/TranslatorWindow';
import TranslatorWindow from '@render/TranslatorWindow.vue';

import 'tdesign-vue-next/es/style/index.css';
import 'tdesign-vue-next/dist/reset.css';

const app = createApp(TranslatorWindow);
app.use(router);
app.mount('#app');

export default app;
