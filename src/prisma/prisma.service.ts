import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  constructor(config: ConfigService) {
    const dbUrl = config.get<string>('DATABASE_URL');
    const connectionLimit = config.get<number>('DB_CONNECTION_LIMIT', 20);  // default 20
    const poolTimeout = config.get<number>('DB_POOL_TIMEOUT', 20);  // default 20
    super({
      datasources: {
        db: {
          url: config.get('DATABASE_URL'),
        },
      },
    });
    this.$on('query' as any, (e: any) => {
      if (e.duration > 1000) {
        this.logger.warn(`Slow Query (${e.duration}ms): ${e.query}`);
      }
    });
  }

  cleanDb() {
    return this.$transaction([
      // this.user.deleteMany(),
    ]);
  }
}
