import { Log } from '../models/Log.js';

interface LogFilters {
  level?: string;
  correlationId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  message?: string;
}

interface PaginatedLogs {
  logs: Array<{
    timestamp: Date;
    level: string;
    correlationId: string;
    message: string;
    userId?: string;
    meta?: Record<string, unknown>;
  }>;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export class LogService {
  static async getLogs(
    filters: LogFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedLogs> {
    const skip = (page - 1) * limit;

    const matchStage: Record<string, unknown> = {};

    if (filters.level) {
      matchStage.level = filters.level;
    }

    if (filters.correlationId) {
      matchStage.correlationId = filters.correlationId;
    }

    if (filters.userId) {
      matchStage.userId = filters.userId;
    }

    if (filters.message) {
      matchStage.message = { $regex: filters.message, $options: 'i' };
    }

    if (filters.startDate || filters.endDate) {
      matchStage.timestamp = {};
      if (filters.startDate) {
        (matchStage.timestamp as Record<string, unknown>).$gte = filters.startDate;
      }
      if (filters.endDate) {
        (matchStage.timestamp as Record<string, unknown>).$lte = filters.endDate;
      }
    }

    const result = await Log.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $facet: {
          metadata: [
            { $count: 'totalCount' },
            {
              $addFields: {
                page,
                limit,
                totalPages: { $ceil: { $divide: ['$totalCount', limit] } },
              },
            },
          ],
          logs: [
            { $sort: { timestamp: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                timestamp: 1,
                level: 1,
                correlationId: 1,
                message: 1,
                userId: 1,
                meta: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          logs: 1,
          metadata: { $arrayElemAt: ['$metadata', 0] },
        },
      },
    ]);

    const data = result[0] as {
      logs: PaginatedLogs['logs'];
      metadata?: { totalCount: number; totalPages: number };
    } | undefined;

    return {
      logs: data?.logs || [],
      totalCount: data?.metadata?.totalCount || 0,
      currentPage: page,
      pageSize: limit,
      totalPages: data?.metadata?.totalPages || 0,
    };
  }

  static async getLogsByCorrelationId(correlationId: string) {
    return await Log.find({ correlationId })
      .sort({ timestamp: 1 })
      .select('-_id')
      .lean();
  }

  static async getLogStatistics() {
    const stats = await Log.aggregate([
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: '$count' },
          levelBreakdown: {
            $push: {
              level: '$_id',
              count: '$count',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalLogs: 1,
          levelBreakdown: 1,
        },
      },
    ]);

    const result = stats[0] as {
      totalLogs: number;
      levelBreakdown: Array<{ level: string; count: number }>;
    } | undefined;

    return (
      result || {
        totalLogs: 0,
        levelBreakdown: [],
      }
    );
  }

  static async getRecentErrors(limit: number = 20) {
    return await Log.find({ level: 'error' })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('-_id')
      .lean();
  }

  static async clearOldLogs(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await Log.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return {
      deletedCount: result.deletedCount,
      cutoffDate,
    };
  }

  static async getLogTrends(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await Log.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
            },
            level: '$level',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          levels: {
            $push: {
              level: '$_id.level',
              count: '$count',
            },
          },
          totalCount: { $sum: '$count' },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $project: {
          date: '$_id',
          levels: 1,
          totalCount: 1,
          _id: 0,
        },
      },
    ]);
  }
}

