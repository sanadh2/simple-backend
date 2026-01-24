import type { Request, Response } from "express"

import { asyncHandler } from "../middleware/errorHandler.js"
import { ActivityService } from "../services/activityService.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class ActivityController {
	static getTimeline = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const startDate = req.query.startDate
			? new Date(req.query.startDate as string)
			: undefined
		const endDate = req.query.endDate
			? new Date(req.query.endDate as string)
			: undefined

		if (startDate && isNaN(startDate.getTime())) {
			throw new Error("Invalid startDate")
		}
		if (endDate && isNaN(endDate.getTime())) {
			throw new Error("Invalid endDate")
		}

		const activities = await ActivityService.getTimeline(
			userId,
			startDate,
			endDate
		)

		ResponseHandler.success(res, 200, {
			message: "Activity timeline retrieved successfully",
			data: activities,
		})
	})
}
