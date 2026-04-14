import * as http from 'http';

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';

@Injectable()
export class HealthService {
  private server: http.Server | null = null;
  private readonly logger = new Logger('HealthService');
  private isBotRunning = false;

  constructor() {}

  public start(port: number = 8080): void {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const status = this.isBotRunning ? 200 : 503;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: this.isBotRunning ? 'ok' : 'unhealthy' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(port, () => {
      this.logger.info(`Health check server listening on port ${port}`);
    });
  }

  public setBotRunning(running: boolean): void {
    this.isBotRunning = running;
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.logger.info('Health check server stopped');
    }
  }
}
