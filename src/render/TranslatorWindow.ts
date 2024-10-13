import './tablet-mode.css';
import TranslatorWindow from '@render/TranslatorWindow.vue';
import router from '@render/router/TranslatorWindow';
import 'tdesign-vue-next/dist/reset.css';
import 'tdesign-vue-next/es/style/index.css';
import { createApp } from 'vue';

const app = createApp(TranslatorWindow);
app.use(router);
app.mount('#app');

export default app;
