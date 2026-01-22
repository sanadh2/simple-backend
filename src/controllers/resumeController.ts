import type { Request, Response } from "express"

import { AppError } from "../middleware/errorHandler.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import {
	createResumeSchema,
	ResumeService,
	updateResumeSchema,
} from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class ResumeController {
	static create = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const file = req.file
		if (!file) {
			throw new AppError("Resume file is required", 400)
		}
		const bodyDescription =
			req.body && typeof req.body === "object" && "description" in req.body
				? (req.body as { description?: unknown }).description
				: undefined
		const bodyFileName =
			req.body && typeof req.body === "object" && "file_name" in req.body
				? (req.body as { file_name?: unknown }).file_name
				: undefined
		const bodyFileSize =
			req.body && typeof req.body === "object" && "file_size" in req.body
				? (req.body as { file_size?: unknown }).file_size
				: undefined

		const validatedData = createResumeSchema.parse({
			description:
				typeof bodyDescription === "string" ? bodyDescription : undefined,
			file_name:
				typeof bodyFileName === "string" ? bodyFileName : file.originalname,
			file_size: typeof bodyFileSize === "number" ? bodyFileSize : file.size,
		})

		const resume = await ResumeService.create(
			userId,
			file.buffer,
			file.originalname,
			validatedData
		)

		logger.info("Resume created", {
			resumeId: resume._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Resume uploaded successfully",
			data: resume,
		})
	})

	static getAll = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const resumes = await ResumeService.getAll(userId)

		ResponseHandler.success(res, 200, {
			message: "Resumes retrieved successfully",
			data: resumes,
		})
	})

	static getById = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new AppError("Resume ID is required", 400)
		}

		const resume = await ResumeService.getById(id, userId)

		if (!resume) {
			throw new AppError("Resume not found", 404)
		}

		ResponseHandler.success(res, 200, {
			message: "Resume retrieved successfully",
			data: resume,
		})
	})

	static update = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new AppError("Resume ID is required", 400)
		}

		const validatedData = updateResumeSchema.parse(req.body)

		const resume = await ResumeService.update(id, userId, validatedData)

		if (!resume) {
			throw new AppError("Resume not found", 404)
		}

		logger.info("Resume updated", {
			resumeId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Resume updated successfully",
			data: resume,
		})
	})

	static delete = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new AppError("Resume ID is required", 400)
		}

		const deleted = await ResumeService.delete(id, userId)

		if (!deleted) {
			throw new AppError("Resume not found", 404)
		}

		logger.info("Resume deleted", {
			resumeId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Resume deleted successfully",
		})
	})

	static getApplications = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new AppError("Resume ID is required", 400)
		}

		const applications = await ResumeService.getApplicationsUsingResume(
			id,
			userId
		)

		ResponseHandler.success(res, 200, {
			message: "Applications retrieved successfully",
			data: applications,
		})
	})

	static download = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new AppError("Resume ID is required", 400)
		}

		const resume = await ResumeService.getById(id, userId)

		if (!resume) {
			throw new AppError("Resume not found", 404)
		}

		// Redirect to the file URL or return it
		ResponseHandler.success(res, 200, {
			message: "Resume URL retrieved successfully",
			data: {
				url: resume.file_url,
				file_name: resume.file_name,
			},
		})
	})
}
