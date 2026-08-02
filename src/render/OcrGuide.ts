import OcrGuide from '@render/OcrGuide.vue';
import { suppressContextMenu } from '@render/utils/suppressContextMenu';
import 'tdesign-vue-next/dist/reset.css';
import 'tdesign-vue-next/es/style/index.css';
import { createApp } from 'vue';

suppressContextMenu();
const app = createApp(OcrGuide);
app.mount('#app');

export default app;
