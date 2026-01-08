import { Worker, Job } from 'bullmq';
import { Log } from '../models/Log.js';
import { env } from '../config/env.js';
import type { LogJob } from '../queues/logQueue.js';

const connection = {
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
};

export const logWorker = new Worker<LogJob>(
  'logs',
  async (job: Job<LogJob>) => {
    const { data } = job;

    try {
      await Log.create({
        timestamp: data.timestamp,
        level: data.level,
        correlationId: data.correlationId,
        message: data.message,
        ...(data.userId && { userId: data.userId }),
        ...(data.meta && { meta: data.meta }),
      });
    } catch (error) {
      console.error('Failed to save log to database:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000,
    },
  }
);

logWorker.on('failed', (job, error) => {
  console.error(`Log job ${job?.id} failed:`, error.message);
});

logWorker.on('error', (error) => {
  console.error('Log worker error:', error);
});

export const startLogWorker = () => {
  console.log('✓ Log worker started');
};

export const stopLogWorker = async () => {
  await logWorker.close();
  console.log('✓ Log worker stopped');
};

