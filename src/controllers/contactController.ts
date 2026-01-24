import type { Request, Response } from "express"

import { AppError } from "../middleware/errorHandler.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import {
	addInteractionSchema,
	ContactService,
	createContactSchema,
	updateContactSchema,
} from "../services/index.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

export class ContactController {
	static create = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		const validatedData = createContactSchema.parse(req.body)

		const contact = await ContactService.create(userId, validatedData)

		logger.info("Application contact created", {
			contactId: contact._id.toString(),
			userId,
		})

		ResponseHandler.success(res, 201, {
			message: "Contact created successfully",
			data: contact,
		})
	})

	static getById = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Contact ID is required")
		}

		const contact = await ContactService.getById(id, userId)

		if (!contact) {
			throw new AppError("Contact not found", 404)
		}

		ResponseHandler.success(res, 200, {
			message: "Contact retrieved successfully",
			data: contact,
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

			const contacts = await ContactService.getByJobApplicationId(
				jobApplicationId,
				userId
			)

			ResponseHandler.success(res, 200, {
				message: "Contacts retrieved successfully",
				data: contacts,
			})
		}
	)

	static update = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Contact ID is required")
		}

		const validatedData = updateContactSchema.parse(req.body)

		const contact = await ContactService.update(id, userId, validatedData)

		if (!contact) {
			throw new AppError("Contact not found", 404)
		}

		logger.info("Contact updated", {
			contactId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Contact updated successfully",
			data: contact,
		})
	})

	static delete = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Contact ID is required")
		}

		const deleted = await ContactService.delete(id, userId)

		if (!deleted) {
			throw new AppError("Contact not found", 404)
		}

		logger.info("Contact deleted", {
			contactId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Contact deleted successfully",
		})
	})

	static addInteraction = asyncHandler(async (req: Request, res: Response) => {
		const userId = (req as Request & { userId?: string }).userId
		const { id } = req.params

		if (!userId) {
			throw new Error("User ID not found in request")
		}

		if (!id) {
			throw new Error("Contact ID is required")
		}

		const validatedData = addInteractionSchema.parse(req.body)

		const contact = await ContactService.addInteraction(
			id,
			userId,
			validatedData
		)

		if (!contact) {
			throw new AppError("Contact not found", 404)
		}

		logger.info("Interaction added to contact", {
			contactId: id,
			userId,
		})

		ResponseHandler.success(res, 200, {
			message: "Interaction added successfully",
			data: contact,
		})
	})
}
