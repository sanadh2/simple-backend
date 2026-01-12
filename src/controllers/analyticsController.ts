import type { Request, Response } from "express"

import { asyncHandler } from "../middleware/errorHandler.js"
import { AnalyticsService } from "../services/analyticsService.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class AnalyticsController {
	static getStatistics = asyncHandler(async (_req: Request, res: Response) => {
		logger.info("Fetching user statistics")
		const stats = await AnalyticsService.getUserStatistics()

		ResponseHandler.success(res, 200, {
			message: "User statistics retrieved successfully",
			data: stats,
		})
	})

	static getRegistrationTrends = asyncHandler(
		async (req: Request, res: Response) => {
			const days = parseInt(req.query.days as string) || 30
			logger.info("Fetching registration trends", { days })

			const trends = await AnalyticsService.getRegistrationTrends(days)

			ResponseHandler.success(res, 200, {
				message: "Registration trends retrieved successfully",
				data: trends,
			})
		}
	)

	static getActiveSessionsAnalysis = asyncHandler(
		async (_req: Request, res: Response) => {
			logger.info("Fetching active sessions analysis")
			const analysis = await AnalyticsService.getActiveSessionsAnalysis()

			ResponseHandler.success(res, 200, {
				message: "Active sessions analysis retrieved successfully",
				data: analysis,
			})
		}
	)

	static searchUsers = asyncHandler(async (req: Request, res: Response) => {
		const searchTerm = req.query.q as string
		const limit = parseInt(req.query.limit as string) || 20

		logger.info("Searching users", { searchTerm, limit })
		const users = await AnalyticsService.searchUsersByName(searchTerm, limit)

		ResponseHandler.success(res, 200, {
			message: "Users found successfully",
			data: users,
		})
	})

	static getUsersPaginated = asyncHandler(
		async (req: Request, res: Response) => {
			const page = parseInt(req.query.page as string) || 1
			const limit = parseInt(req.query.limit as string) || 10

			logger.info("Fetching paginated users", { page, limit })
			const result = await AnalyticsService.getUsersWithPagination(page, limit)

			ResponseHandler.success(res, 200, {
				message: "Users retrieved successfully",
				data: result,
			})
		}
	)

	static getInactiveUsers = asyncHandler(
		async (req: Request, res: Response) => {
			const days = parseInt(req.query.days as string) || 30
			logger.info("Fetching inactive users", { days })

			const users = await AnalyticsService.getInactiveUsers(days)

			ResponseHandler.success(res, 200, {
				message: "Inactive users retrieved successfully",
				data: users,
			})
		}
	)

	static getEmailDomainStats = asyncHandler(
		async (_req: Request, res: Response) => {
			logger.info("Fetching email domain statistics")
			const stats = await AnalyticsService.getEmailDomainStats()

			ResponseHandler.success(res, 200, {
				message: "Email domain statistics retrieved successfully",
				data: stats,
			})
		}
	)

	static getCohortAnalysis = asyncHandler(
		async (_req: Request, res: Response) => {
			logger.info("Fetching cohort analysis")
			const analysis = await AnalyticsService.getCohortAnalysis()

			ResponseHandler.success(res, 200, {
				message: "Cohort analysis retrieved successfully",
				data: analysis,
			})
		}
	)

	static getPowerUsers = asyncHandler(async (_req: Request, res: Response) => {
		logger.info("Fetching power users")
		const users = await AnalyticsService.getPowerUsers()

		ResponseHandler.success(res, 200, {
			message: "Power users retrieved successfully",
			data: users,
		})
	})
}
