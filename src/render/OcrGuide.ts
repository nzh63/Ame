import { createApp } from 'vue';

import OcrGuide from '@render/OcrGuide.vue';

import 'ant-design-vue/dist/antd.css';

const app = createApp(OcrGuide);
app.mount('#app');

export default app;
