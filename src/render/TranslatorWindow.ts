import { createApp } from 'vue';

import router from '@render/router/TranslatorWindow';
import TranslatorWindow from '@render/TranslatorWindow.vue';
import antd from 'ant-design-vue';
import 'ant-design-vue/dist/antd.dark.css';

const app = createApp(TranslatorWindow);

app.use(router);
app.use(antd);
app.mount('#app');

export default app;
