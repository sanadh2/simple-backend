import type { Request, Response } from "express"

import { AppError, asyncHandler } from "../middleware/errorHandler.js"
import { DashboardAnalyticsService } from "../services/dashboardAnalyticsService.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class DashboardAnalyticsController {
	static getDashboard = asyncHandler(async (req: Request, res: Response) => {
		const userId = req.userId
		if (!userId) {
			throw new AppError("Authentication required", 401)
		}
		logger.info("Fetching dashboard analytics", { userId })
		const data = await DashboardAnalyticsService.getDashboardAnalytics(userId)
		ResponseHandler.success(res, 200, {
			message: "Dashboard analytics retrieved successfully",
			data,
		})
	})
}
