import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleInit {
  private connection: IORedis;

  async onModuleInit() {
    this.connection = new IORedis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,   // Required by BullMQ
    });
  }

  /** Return queue instance */
  getQueue(queueName: string) {
    return new Queue(queueName, {
      connection: this.connection,
    });
  }

  /** Add job with job options */
  async addJob(
    queueName: string,
    jobName: string,
    payload: any,
    options?: JobsOptions,
  ) {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, payload, options);
  }

  /** Register worker */
  registerWorker(
    queueName: string,
    processor: (job: any) => any,
    concurrency = 1,
  ) {
    const worker = new Worker(queueName, processor, {
      connection: this.connection,
      concurrency,
    });

    const events = new QueueEvents(queueName, {
      connection: this.connection,
    });

    events.on('completed', ({ jobId }) =>
      console.log(`Job ${jobId} completed in queue ${queueName}`),
    );

    events.on('failed', ({ jobId, failedReason }) =>
      console.error(
        `Job ${jobId} FAILED in queue ${queueName}: ${failedReason}`,
      ),
    );

    return worker;
  }
}