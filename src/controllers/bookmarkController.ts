import type { Request, Response } from "express"
import { z } from "zod"

import { asyncHandler } from "../middleware/errorHandler.js"
import { BookmarkService } from "../services/index.js"
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
		logger.debug("Create bookmark request received", {
			userId: req.userId,
			url: (req.body as { url?: string }).url,
			hasTitle: !!(req.body as { title?: string }).title,
		})

		if (!req.userId) {
			logger.warn("Create bookmark failed: Unauthorized", {
				url: (req.body as { url?: string }).url,
			})
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		let validatedData
		try {
			validatedData = createBookmarkSchema.parse(req.body)
			logger.debug("Bookmark data validated", {
				userId: req.userId,
				url: validatedData.url,
				hasTags: !!validatedData.tags && validatedData.tags.length > 0,
			})
		} catch (error) {
			logger.warn("Bookmark validation failed", {
				userId: req.userId,
				error: error instanceof Error ? error.message : "Unknown",
			})
			throw error
		}

		logger.debug("Creating bookmark", {
			userId: req.userId,
			url: validatedData.url,
		})

		const result = await BookmarkService.createBookmark(
			req.userId,
			validatedData
		)

		logger.info("Bookmark created", {
			userId: req.userId,
			bookmarkId: result.bookmark._id,
			url: result.bookmark.url,
		})

		ResponseHandler.success(res, 201, {
			message: "Bookmark created successfully",
			data: {
				bookmark: result.bookmark,
			},
		})
	})

	static getBookmarks = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Get bookmarks request received", {
			userId: req.userId,
			query: req.query,
		})

		if (!req.userId) {
			logger.warn("Get bookmarks failed: Unauthorized")
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		let filters
		try {
			filters = getBookmarksSchema.parse(req.query)
			logger.debug("Bookmark filters validated", {
				userId: req.userId,
				filters,
			})
		} catch (error) {
			logger.warn("Bookmark filter validation failed", {
				userId: req.userId,
				error: error instanceof Error ? error.message : "Unknown",
			})
			throw error
		}

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

		logger.debug("Fetching bookmarks with filters", {
			userId: req.userId,
			cleanFilters,
		})

		const result = await BookmarkService.getBookmarks(req.userId, cleanFilters)

		logger.debug("Bookmarks retrieved", {
			userId: req.userId,
			count: result.bookmarks.length,
			totalCount: result.totalCount,
		})

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
		logger.debug("Update bookmark request received", {
			userId: req.userId,
			bookmarkId: req.params.id,
			hasBody:
				!!req.body &&
				Object.keys(req.body as Record<string, unknown>).length > 0,
		})

		if (!req.userId) {
			logger.warn("Update bookmark failed: Unauthorized", {
				bookmarkId: req.params.id,
			})
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const bookmarkId = req.params.id
		if (!bookmarkId) {
			logger.warn("Update bookmark failed: Missing bookmark ID")
			return ResponseHandler.error(res, 400, "Bookmark ID is required")
		}

		let validatedData
		try {
			validatedData = updateBookmarkSchema.parse(req.body)
			logger.debug("Update bookmark data validated", {
				userId: req.userId,
				bookmarkId,
				fieldsToUpdate: Object.keys(validatedData),
			})
		} catch (error) {
			logger.warn("Update bookmark validation failed", {
				userId: req.userId,
				bookmarkId,
				error: error instanceof Error ? error.message : "Unknown",
			})
			throw error
		}

		logger.debug("Updating bookmark", {
			userId: req.userId,
			bookmarkId,
		})

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
