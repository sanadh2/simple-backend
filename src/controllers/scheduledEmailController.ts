import type { Request, Response } from "express"

import { asyncHandler } from "../middleware/errorHandler.js"
import { ScheduledEmailService } from "../services/scheduledEmailService.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class ScheduledEmailController {
	static getUpcoming = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const limit = req.query.limit
			? Math.min(Math.max(1, parseInt(req.query.limit as string, 10)), 50)
			: 10

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const emails = await ScheduledEmailService.getUpcoming(userId, limit)

		ResponseHandler.success(res, 200, {
			message: "Upcoming scheduled emails retrieved successfully",
			data: emails,
		})
	})
}
