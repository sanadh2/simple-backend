import type { Request, Response } from "express"

import { asyncHandler } from "../middleware/errorHandler.js"
import {
	createJobApplicationSchema,
	JobApplicationService,
	updateJobApplicationSchema,
} from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class JobApplicationController {
	static create = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const validatedData = createJobApplicationSchema.parse(req.body)

		const jobApplication = await JobApplicationService.create(
			userId,
			validatedData
		)

		logger.info("Job application created", {
			jobApplicationId: jobApplication._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Job application created successfully",
			data: jobApplication,
		})
	})

	static getById = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Job application ID is required")
		}

		const jobApplication = await JobApplicationService.getById(id, userId)

		if (!jobApplication) {
			throw new Error("Job application not found")
		}

		ResponseHandler.success(res, 200, {
			message: "Job application retrieved successfully",
			data: jobApplication,
		})
	})

	static getAll = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const page = parseInt(req.query.page as string) || 1
		const limit = parseInt(req.query.limit as string) || 20

		const filters: Record<string, string | Date> = {}

		if (req.query.status) filters.status = req.query.status as string
		if (req.query.priority) filters.priority = req.query.priority as string
		if (req.query.company_name)
			filters.company_name = req.query.company_name as string
		if (req.query.startDate)
			filters.startDate = new Date(req.query.startDate as string)
		if (req.query.endDate)
			filters.endDate = new Date(req.query.endDate as string)

		const result = await JobApplicationService.getAll(
			userId,
			filters,
			page,
			limit
		)

		ResponseHandler.success(res, 200, {
			message: "Job applications retrieved successfully",
			data: result,
		})
	})

	static update = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Job application ID is required")
		}

		const validatedData = updateJobApplicationSchema.parse(req.body)

		const jobApplication = await JobApplicationService.update(
			id,
			userId,
			validatedData
		)

		if (!jobApplication) {
			throw new Error("Job application not found")
		}

		logger.info("Job application updated", {
			jobApplicationId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Job application updated successfully",
			data: jobApplication,
		})
	})

	static delete = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Job application ID is required")
		}

		const deleted = await JobApplicationService.delete(id, userId)

		if (!deleted) {
			throw new Error("Job application not found")
		}

		logger.info("Job application deleted", {
			jobApplicationId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Job application deleted successfully",
		})
	})
}
