import { createApp } from 'vue';

import router from '@render/router/MainWindow';
import MainWindow from '@render/MainWindow.vue';

import 'tdesign-vue-next/es/style/index.css';
import 'tdesign-vue-next/dist/reset.css';

const app = createApp(MainWindow);
app.use(router);
app.mount('#app');

export default app;
