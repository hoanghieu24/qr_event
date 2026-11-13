import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import { warmUpBackend } from './api/client';

warmUpBackend(0);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    warmUpBackend();
  }
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
