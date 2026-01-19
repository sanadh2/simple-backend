import mongoose from "mongoose"

import { AppError } from "../middleware/errorHandler.js"
import { Bookmark, type IBookmark } from "../models/Bookmark.js"
import { logger } from "../utils/logger.js"

export interface CreateBookmarkDTO {
	url: string
	title: string
	description?: string | undefined
	tags?: string[] | undefined
}

export interface UpdateBookmarkDTO {
	title?: string | undefined
	description?: string | undefined
	tags?: string[] | undefined
}

export class BookmarkService {
	static async createBookmark(
		userId: string,
		data: CreateBookmarkDTO
	): Promise<{ bookmark: IBookmark }> {
		logger.debug("Creating bookmark in service", {
			userId,
			url: data.url,
			title: data.title,
		})

		logger.debug("Checking for existing bookmark with same URL", {
			userId,
			url: data.url,
		})
		const existingBookmark = await Bookmark.findOne({ userId, url: data.url })

		if (existingBookmark) {
			logger.warn("Bookmark creation failed: URL already exists", {
				userId,
				url: data.url,
				existingBookmarkId: existingBookmark._id.toString(),
			})
			throw new AppError("Bookmark with this URL already exists", 409)
		}

		const tags = data.tags || []
		const aiGenerated = false
		const description = data.description

		logger.debug("Preparing bookmark data", {
			userId,
			url: data.url,
			tagsCount: tags.length,
			hasDescription: !!description,
		})

		const bookmarkData = {
			userId: new mongoose.Types.ObjectId(userId),
			url: data.url,
			title: data.title,
			tags,
			aiGenerated,
			...(description && { description }),
		}

		logger.debug("Saving bookmark to database", {
			userId,
			url: data.url,
		})

		const bookmark = await Bookmark.create(bookmarkData)

		logger.debug("Bookmark created successfully", {
			userId,
			bookmarkId: bookmark._id.toString(),
			url: bookmark.url,
		})

		return { bookmark }
	}

	static async getBookmarks(
		userId: string,
		filters: { tag?: string; search?: string; limit?: number; skip?: number }
	) {
		logger.debug("Getting bookmarks in service", {
			userId,
			filters,
		})

		const query: Record<string, unknown> = { userId }

		if (filters.tag) {
			query.tags = filters.tag
			logger.debug("Adding tag filter", {
				userId,
				tag: filters.tag,
			})
		}

		if (filters.search) {
			query.$or = [
				{ title: { $regex: filters.search, $options: "i" } },
				{ description: { $regex: filters.search, $options: "i" } },
				{ url: { $regex: filters.search, $options: "i" } },
			]
			logger.debug("Adding search filter", {
				userId,
				searchTerm: filters.search,
			})
		}

		const limit = filters.limit || 50
		const skip = filters.skip || 0

		logger.debug("Executing database query", {
			userId,
			query,
			limit,
			skip,
		})

		const [bookmarks, totalCount] = await Promise.all([
			Bookmark.find(query)
				.sort({ createdAt: -1 })
				.limit(limit)
				.skip(skip)
				.lean(),
			Bookmark.countDocuments(query),
		])

		logger.debug("Bookmarks query completed", {
			userId,
			returnedCount: bookmarks.length,
			totalCount,
			hasMore: skip + bookmarks.length < totalCount,
		})

		return {
			bookmarks,
			totalCount,
			hasMore: skip + bookmarks.length < totalCount,
		}
	}

	static async getBookmarkById(
		userId: string,
		bookmarkId: string
	): Promise<IBookmark> {
		const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId })

		if (!bookmark) {
			throw new AppError("Bookmark not found", 404)
		}

		return bookmark
	}

	static async updateBookmark(
		userId: string,
		bookmarkId: string,
		data: UpdateBookmarkDTO
	): Promise<IBookmark> {
		const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId })

		if (!bookmark) {
			throw new AppError("Bookmark not found", 404)
		}

		if (data.title) bookmark.title = data.title
		if (data.description !== undefined) bookmark.description = data.description
		if (data.tags) bookmark.tags = data.tags

		await bookmark.save()

		return bookmark
	}

	static async deleteBookmark(
		userId: string,
		bookmarkId: string
	): Promise<void> {
		logger.debug("Deleting bookmark in service", {
			userId,
			bookmarkId,
		})

		const result = await Bookmark.deleteOne({ _id: bookmarkId, userId })

		logger.debug("Bookmark delete operation completed", {
			userId,
			bookmarkId,
			deletedCount: result.deletedCount,
		})

		if (result.deletedCount === 0) {
			logger.warn("Bookmark deletion failed: Not found", {
				userId,
				bookmarkId,
			})
			throw new AppError("Bookmark not found", 404)
		}

		logger.debug("Bookmark deleted successfully", {
			userId,
			bookmarkId,
		})
	}

	static async getAllTags(userId: string): Promise<string[]> {
		const result = await Bookmark.aggregate<{ tag: string; count: number }>([
			{ $match: { userId } },
			{ $unwind: "$tags" },
			{ $group: { _id: "$tags", count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $project: { _id: 0, tag: "$_id", count: 1 } },
		])

		return result.map((r) => r.tag)
	}
}
