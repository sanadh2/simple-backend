import type { Request, Response } from "express"

import { AppError } from "../middleware/errorHandler.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import {
	createJobApplicationSchema,
	JobApplicationService,
	quickCreateJobApplicationSchema,
	updateJobApplicationSchema,
} from "../services/index.js"
import { fileUploadService } from "../services/index.js"
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

	static quick = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const q = quickCreateJobApplicationSchema.parse(req.body)

		let job_posting_url: string | undefined =
			q.job_posting_url && q.job_posting_url.trim() !== ""
				? q.job_posting_url.trim()
				: undefined

		// Rewrite LinkedIn/Indeed list URLs to canonical job view URL when possible
		if (job_posting_url) {
			try {
				const u = new URL(job_posting_url)
				const id = u.searchParams.get("currentJobId")
				if (id && /^\d+$/.test(id)) {
					const host = (u.hostname || "").toLowerCase()
					if (host.includes("linkedin.com")) {
						job_posting_url = `https://www.linkedin.com/jobs/view/${id}`
					}
					// Indeed uses different param; add if needed: vjk, jk, etc.
				}
			} catch {
				// keep original URL on parse error
			}
		}

		// Sanitize description: strip boilerplate, normalize whitespace
		let job_description = q.job_description
		if (job_description && typeof job_description === "string") {
			job_description = job_description
				.replace(
					/^(?:About the job|Job description|Description)\s*[\n\s]*/i,
					""
				)
				.replace(/\n\s*\n\s*\n+/g, "\n\n")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n[ \t]+/g, "\n")
				.trim()
			if (job_description === "") job_description = undefined
		}

		const full: Parameters<typeof JobApplicationService.create>[1] = {
			company_name: q.company_name,
			job_title: q.job_title,
			job_description,
			job_posting_url,
			application_method: q.application_method,
			application_date: new Date(),
			status: "Wishlist",
			location_type: "remote",
			priority: "medium",
		}

		const jobApplication = await JobApplicationService.create(userId, full)

		logger.info("Job application quick-created", {
			jobApplicationId: jobApplication._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Job application saved",
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
		if (req.query.search) filters.search = req.query.search as string
		if (req.query.startDate)
			filters.startDate = new Date(req.query.startDate as string)
		if (req.query.endDate)
			filters.endDate = new Date(req.query.endDate as string)
		if (req.query.sortBy) filters.sortBy = req.query.sortBy as string
		if (req.query.sortOrder)
			filters.sortOrder = req.query.sortOrder as "asc" | "desc"

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

	static uploadFile = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!req.file) {
			throw new AppError("No file uploaded", 400)
		}

		const body = req.body as { fileType?: string } | undefined
		const fileType = body?.fileType

		if (!fileType || !["resume", "cover_letter"].includes(fileType)) {
			throw new AppError(
				"Invalid file type. Must be 'resume' or 'cover_letter'",
				400
			)
		}

		const folder = `job-applications/${fileType}`
		const uploadResult = await fileUploadService.uploadFile(
			req.file.buffer,
			req.file.originalname,
			folder,
			userId,
			"raw"
		)

		logger.info("Job application file uploaded", {
			userId,
			fileType,
			url: uploadResult.url,
		})

		ResponseHandler.success(res, 200, {
			message: "File uploaded successfully",
			data: {
				url: uploadResult.url,
				publicId: uploadResult.publicId,
			},
		})
	})
}
