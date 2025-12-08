import { App } from './app';

const app = new App();

app.init().catch((error) => {
  console.error('[App] App initialization error:', error);
  process.exit(1);
});
