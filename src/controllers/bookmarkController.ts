import type { Request, Response } from "express"
import { z } from "zod"

import { asyncHandler } from "../middleware/errorHandler.js"
import { BookmarkService } from "../services/bookmarkService.js"
import { logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

const createBookmarkSchema = z.object({
	url: z.url(),
	title: z.string().min(1, "Title is required").trim(),
	description: z.string().trim().optional(),
	tags: z.array(z.string()).optional(),
})

const updateBookmarkSchema = z.object({
	title: z.string().min(1).trim().optional(),
	description: z.string().trim().optional(),
	tags: z.array(z.string()).optional(),
})

const getBookmarksSchema = z.object({
	tag: z.string().optional(),
	search: z.string().optional(),
	limit: z.coerce.number().positive().optional(),
	skip: z.coerce.number().nonnegative().optional(),
})

export class BookmarkController {
	static createBookmark = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const validatedData = createBookmarkSchema.parse(req.body)

		const result = await BookmarkService.createBookmark(
			req.userId,
			validatedData
		)

		logger.info("Bookmark created", {
			userId: req.userId,
			bookmarkId: result.bookmark._id,
		})

		ResponseHandler.success(res, 201, {
			message: "Bookmark created successfully",
			data: {
				bookmark: result.bookmark,
			},
		})
	})

	static getBookmarks = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const filters = getBookmarksSchema.parse(req.query)

		const cleanFilters: {
			tag?: string
			search?: string
			limit?: number
			skip?: number
		} = {}
		if (filters.tag) cleanFilters.tag = filters.tag
		if (filters.search) cleanFilters.search = filters.search
		if (filters.limit) cleanFilters.limit = filters.limit
		if (filters.skip !== undefined) cleanFilters.skip = filters.skip

		const result = await BookmarkService.getBookmarks(req.userId, cleanFilters)

		ResponseHandler.success(res, 200, {
			message: "Bookmarks retrieved successfully",
			data: result,
		})
	})

	static getBookmarkById = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const bookmarkId = req.params.id
		if (!bookmarkId) {
			return ResponseHandler.error(res, 400, "Bookmark ID is required")
		}

		const bookmark = await BookmarkService.getBookmarkById(
			req.userId,
			bookmarkId
		)

		ResponseHandler.success(res, 200, {
			message: "Bookmark retrieved successfully",
			data: bookmark,
		})
	})

	static updateBookmark = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const bookmarkId = req.params.id
		if (!bookmarkId) {
			return ResponseHandler.error(res, 400, "Bookmark ID is required")
		}

		const validatedData = updateBookmarkSchema.parse(req.body)

		const bookmark = await BookmarkService.updateBookmark(
			req.userId,
			bookmarkId,
			validatedData
		)

		logger.info("Bookmark updated", {
			userId: req.userId,
			bookmarkId: bookmark._id,
		})

		ResponseHandler.success(res, 200, {
			message: "Bookmark updated successfully",
			data: bookmark,
		})
	})

	static deleteBookmark = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const bookmarkId = req.params.id
		if (!bookmarkId) {
			return ResponseHandler.error(res, 400, "Bookmark ID is required")
		}

		await BookmarkService.deleteBookmark(req.userId, bookmarkId)

		logger.info("Bookmark deleted", { userId: req.userId, bookmarkId })

		ResponseHandler.success(res, 200, {
			message: "Bookmark deleted successfully",
		})
	})

	static getAllTags = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const tags = await BookmarkService.getAllTags(req.userId)

		ResponseHandler.success(res, 200, {
			message: "Tags retrieved successfully",
			data: tags,
		})
	})
}
