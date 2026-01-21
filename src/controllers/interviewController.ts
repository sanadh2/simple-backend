import type { Request, Response } from "express"

import { AppError } from "../middleware/errorHandler.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import {
	createInterviewSchema,
	InterviewService,
	updateInterviewSchema,
} from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class InterviewController {
	static create = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const validatedData = createInterviewSchema.parse(req.body)

		const interview = await InterviewService.create(userId, validatedData)

		logger.info("Interview created", {
			interviewId: interview._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Interview created successfully",
			data: interview,
		})
	})

	static getById = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Interview ID is required")
		}

		const interview = await InterviewService.getById(id, userId)

		if (!interview) {
			throw new AppError("Interview not found", 404)
		}

		ResponseHandler.success(res, 200, {
			message: "Interview retrieved successfully",
			data: interview,
		})
	})

	static getByJobApplicationId = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = (req as Request & { userId?: string }).userId
			const { jobApplicationId } = req.params

			if (!userId) {
				throw new Error("User ID not found in request")
			}

			if (!jobApplicationId) {
				throw new Error("Job application ID is required")
			}

			const interviews = await InterviewService.getByJobApplicationId(
				jobApplicationId,
				userId
			)

			ResponseHandler.success(res, 200, {
				message: "Interviews retrieved successfully",
				data: interviews,
			})
		}
	)

	static getAll = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const interviews = await InterviewService.getAll(userId)

		ResponseHandler.success(res, 200, {
			message: "Interviews retrieved successfully",
			data: interviews,
		})
	})

	static getUpcoming = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const days = req.query.days ? parseInt(req.query.days as string, 10) : 30

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const interviews = await InterviewService.getUpcomingInterviews(
			userId,
			days
		)

		ResponseHandler.success(res, 200, {
			message: "Upcoming interviews retrieved successfully",
			data: interviews,
		})
	})

	static update = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Interview ID is required")
		}

		const validatedData = updateInterviewSchema.parse(req.body)

		const interview = await InterviewService.update(id, userId, validatedData)

		if (!interview) {
			throw new AppError("Interview not found", 404)
		}

		logger.info("Interview updated", {
			interviewId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Interview updated successfully",
			data: interview,
		})
	})

	static delete = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Interview ID is required")
		}

		const deleted = await InterviewService.delete(id, userId)

		if (!deleted) {
			throw new AppError("Interview not found", 404)
		}

		logger.info("Interview deleted", {
			interviewId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Interview deleted successfully",
		})
	})
}
