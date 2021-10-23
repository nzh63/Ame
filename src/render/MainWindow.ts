import { createApp } from 'vue';

import router from '@render/router/MainWindow';
import MainWindow from '@render/MainWindow.vue';

import 'ant-design-vue/dist/antd.css';

const app = createApp(MainWindow);
app.use(router);
app.mount('#app');

export default app;
