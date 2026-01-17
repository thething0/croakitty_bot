import { Logger } from './utils/logger';

import { bootstrap } from './app';

const logger = new Logger('index');

bootstrap().catch((error) => {
  logger.error('App initialization error:', error);
  process.exit(1);
});
