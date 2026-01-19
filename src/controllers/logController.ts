import type { Request, Response } from "express"

import { asyncHandler } from "../middleware/errorHandler.js"
import { LogService } from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class LogController {
	static getLogs = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Get logs request received", {
			query: req.query,
			userId: (req as Request & { userId?: string }).userId,
		})

		const page = parseInt(req.query.page as string) || 1
		const limit = parseInt(req.query.limit as string) || 50

		logger.debug("Parsing log filters", {
			page,
			limit,
			rawQuery: req.query,
		})

		const filters: Record<string, string | Date> = {}

		if (req.query.level) filters.level = req.query.level as string
		if (req.query.correlation_id)
			filters.correlation_id = req.query.correlation_id as string
		if (req.query.userId) filters.user_id = req.query.userId as string
		if (req.query.message) filters.message = req.query.message as string
		if (req.query.startDate)
			filters.startDate = new Date(req.query.startDate as string)
		if (req.query.endDate)
			filters.endDate = new Date(req.query.endDate as string)

		logger.debug("Fetching logs with filters", {
			filters,
			page,
			limit,
		})

		const result = await LogService.getLogs(filters, page, limit)

		logger.debug("Logs retrieved", {
			count: result.logs.length,
			totalCount: result.totalCount,
			currentPage: result.currentPage,
		})

		ResponseHandler.success(res, 200, {
			message: "Logs retrieved successfully",
			data: result,
		})
	})

	static getLogsBycorrelation_id = asyncHandler(
		async (req: Request, res: Response) => {
			const correlation_id = req.params.correlation_id
			if (!correlation_id) {
				throw new Error("Correlation ID is required")
			}
			const logs = await LogService.getLogsBycorrelation_id(correlation_id)

			ResponseHandler.success(res, 200, {
				message: "Logs retrieved successfully",
				data: logs,
			})
		}
	)

	static getLogStatistics = asyncHandler(
		async (_req: Request, res: Response) => {
			const stats = await LogService.getLogStatistics()

			ResponseHandler.success(res, 200, {
				message: "Log statistics retrieved successfully",
				data: stats,
			})
		}
	)

	static getRecentErrors = asyncHandler(async (req: Request, res: Response) => {
		const limit = parseInt(req.query.limit as string) || 20
		const errors = await LogService.getRecentErrors(limit)

		ResponseHandler.success(res, 200, {
			message: "Recent errors retrieved successfully",
			data: errors,
		})
	})

	static clearOldLogs = asyncHandler(async (req: Request, res: Response) => {
		const days = parseInt(req.query.days as string) || 30

		logger.debug("Clear old logs request received", {
			days,
			userId: (req as Request & { userId?: string }).userId,
		})

		logger.info("Clearing old logs", {
			days,
		})

		const result = await LogService.clearOldLogs(days)

		logger.info("Old logs cleared", {
			days,
			deletedCount: result.deletedCount,
		})

		ResponseHandler.success(res, 200, {
			message: `Cleared logs older than ${days} days`,
			data: result,
		})
	})

	static getLogTrends = asyncHandler(async (req: Request, res: Response) => {
		const days = parseInt(req.query.days as string) || 7
		const trends = await LogService.getLogTrends(days)

		ResponseHandler.success(res, 200, {
			message: "Log trends retrieved successfully",
			data: trends,
		})
	})
}
