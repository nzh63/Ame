import MainWindow from '@render/MainWindow.vue';
import router from '@render/router/MainWindow';
import 'tdesign-vue-next/dist/reset.css';
import 'tdesign-vue-next/es/style/index.css';
import { createApp } from 'vue';

const app = createApp(MainWindow);
app.use(router);
app.mount('#app');

export default app;
