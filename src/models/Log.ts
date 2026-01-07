import mongoose, { Document, Schema } from 'mongoose';

export interface ILog extends Document {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  correlationId: string;
  message: string;
  userId?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const logSchema = new Schema<ILog>(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    level: {
      type: String,
      required: true,
      enum: ['info', 'warn', 'error', 'debug'],
      index: true,
    },
    correlationId: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      index: true,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    capped: { size: 50 * 1024 * 1024, max: 100000 },
  }
);

logSchema.index({ timestamp: -1 });
logSchema.index({ level: 1, timestamp: -1 });
logSchema.index({ correlationId: 1, timestamp: 1 });

export const Log = mongoose.model<ILog>('Log', logSchema);

