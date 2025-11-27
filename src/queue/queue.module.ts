import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ScraperWorker } from './workers/scraper.worker';

@Module({
  providers: [QueueService, ScraperWorker],
  exports: [QueueService],
})
export class QueueModule { }

