import type { Request, Response } from 'express';
import { LogService } from '../services/logService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ResponseHandler } from '../utils/responseHandler.js';

export class LogController {
  static getLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const filters = {
      level: req.query.level as string | undefined,
      correlationId: req.query.correlationId as string | undefined,
      userId: req.query.userId as string | undefined,
      message: req.query.message as string | undefined,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    };

    const result = await LogService.getLogs(filters, page, limit);

    ResponseHandler.success(res, 200, {
      message: 'Logs retrieved successfully',
      data: result,
    });
  });

  static getLogsByCorrelationId = asyncHandler(
    async (req: Request, res: Response) => {
      const { correlationId } = req.params;
      const logs = await LogService.getLogsByCorrelationId(correlationId);

      ResponseHandler.success(res, 200, {
        message: 'Logs retrieved successfully',
        data: logs,
      });
    }
  );

  static getLogStatistics = asyncHandler(
    async (_req: Request, res: Response) => {
      const stats = await LogService.getLogStatistics();

      ResponseHandler.success(res, 200, {
        message: 'Log statistics retrieved successfully',
        data: stats,
      });
    }
  );

  static getRecentErrors = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const errors = await LogService.getRecentErrors(limit);

    ResponseHandler.success(res, 200, {
      message: 'Recent errors retrieved successfully',
      data: errors,
    });
  });

  static clearOldLogs = asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const result = await LogService.clearOldLogs(days);

    ResponseHandler.success(res, 200, {
      message: `Cleared logs older than ${days} days`,
      data: result,
    });
  });

  static getLogTrends = asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const trends = await LogService.getLogTrends(days);

    ResponseHandler.success(res, 200, {
      message: 'Log trends retrieved successfully',
      data: trends,
    });
  });
}

