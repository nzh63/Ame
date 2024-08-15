import { createApp } from 'vue';

import OcrGuide from '@render/OcrGuide.vue';

import 'tdesign-vue-next/es/style/index.css';
import 'tdesign-vue-next/dist/reset.css';

const app = createApp(OcrGuide);
app.mount('#app');

export default app;
