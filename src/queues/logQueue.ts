import { Queue } from 'bullmq';
import { env } from '../config/env.js';

export interface LogJob {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  correlationId: string;
  message: string;
  userId?: string;
  meta?: Record<string, unknown>;
}

const connection = {
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
};

export const logQueue = new Queue<LogJob>('logs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600,
    },
  },
});

logQueue.on('error', (error) => {
  console.error('Log queue error:', error);
});

