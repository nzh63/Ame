import { createApp } from 'vue';

import OcrGuide from '@render/OcrGuide.vue';
import antd from 'ant-design-vue';

import 'ant-design-vue/dist/antd.css';

const app = createApp(OcrGuide);

app.use(antd);
app.mount('#app');

export default app;
