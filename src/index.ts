import { bootstrap } from './app';

bootstrap().catch((error) => {
  console.error('[App] App initialization error:', error);
  process.exit(1);
});
