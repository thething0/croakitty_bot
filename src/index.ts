import { App } from './app';

const app = new App();

app.init().catch((error) => {
  console.error('Ошибка при инициализации приложения:', error);
  process.exit(1);
});
