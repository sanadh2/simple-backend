import type { Request, Response } from "express"

import { AppError } from "../middleware/errorHandler.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import {
	CompanyService,
	createCompanySchema,
	updateCompanySchema,
} from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class CompanyController {
	static create = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const validatedData = createCompanySchema.parse(req.body)

		const company = await CompanyService.create(userId, validatedData)

		logger.info("Company created", {
			companyId: company._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Company created successfully",
			data: company,
		})
	})

	static getById = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params
		const includeApplications =
			req.query.includeApplications === "true" || false

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Company ID is required")
		}

		const company = await CompanyService.getById(
			id,
			userId,
			includeApplications
		)

		if (!company) {
			throw new AppError("Company not found", 404)
		}

		ResponseHandler.success(res, 200, {
			message: "Company retrieved successfully",
			data: company,
		})
	})

	static getAll = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const page = parseInt(req.query.page as string) || 1
		const limit = parseInt(req.query.limit as string) || 20

		const filters: Record<string, string> = {}

		if (req.query.search) filters.search = req.query.search as string
		if (req.query.size) filters.size = req.query.size as string
		if (req.query.industry) filters.industry = req.query.industry as string
		if (req.query.funding_stage)
			filters.funding_stage = req.query.funding_stage as string
		if (req.query.sortBy) filters.sortBy = req.query.sortBy as string
		if (req.query.sortOrder)
			filters.sortOrder = req.query.sortOrder as "asc" | "desc"

		const result = await CompanyService.getAll(userId, filters, page, limit)

		ResponseHandler.success(res, 200, {
			message: "Companies retrieved successfully",
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
			throw new Error("Company ID is required")
		}

		const validatedData = updateCompanySchema.parse(req.body)

		const company = await CompanyService.update(id, userId, validatedData)

		if (!company) {
			throw new AppError("Company not found", 404)
		}

		logger.info("Company updated", {
			companyId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Company updated successfully",
			data: company,
		})
	})

	static delete = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Company ID is required")
		}

		const deleted = await CompanyService.delete(id, userId)

		if (!deleted) {
			throw new AppError("Company not found", 404)
		}

		logger.info("Company deleted", {
			companyId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Company deleted successfully",
		})
	})
}
