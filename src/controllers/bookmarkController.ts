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
	useAI: z.boolean().optional().default(true),
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
			jobId: result.jobId,
		})

		ResponseHandler.success(res, 201, {
			message: "Bookmark created successfully",
			data: {
				bookmark: result.bookmark,
				...(result.jobId && { jobId: result.jobId }),
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

	static regenerateTags = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const bookmarkId = req.params.id
		if (!bookmarkId) {
			return ResponseHandler.error(res, 400, "Bookmark ID is required")
		}

		const result = await BookmarkService.regenerateTags(req.userId, bookmarkId)

		logger.info("Tag regeneration queued", {
			userId: req.userId,
			bookmarkId,
			jobId: result.jobId,
		})

		ResponseHandler.success(res, 202, {
			message: "Tag regeneration queued",
			data: {
				jobId: result.jobId,
				bookmark: result.bookmark,
				status: "processing",
			},
		})
	})

	static getTagJobStatus = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")
		const jobId = req.params.jobId

		if (!jobId) {
			return ResponseHandler.error(res, 400, "Job ID is required")
		}

		const job = await bookmarkQueue.getJob(jobId)

		if (!job) {
			return ResponseHandler.error(res, 404, "Job not found")
		}

		const state = await job.getState()
		const progress = typeof job.progress === "number" ? job.progress : 0
		const result = job.returnvalue as {
			bookmarkId?: string
			tags?: string[]
			summary?: string
			attempts?: number
		} | null
		const failedReason =
			typeof job.failedReason === "string" ? job.failedReason : null
		const attemptsMade =
			typeof job.attemptsMade === "number" ? job.attemptsMade : 0
		const maxAttempts =
			typeof job.opts.attempts === "number" ? job.opts.attempts : 5
		const isRetryable = failedReason
			? !failedReason.includes("Permanent failure")
			: false

		ResponseHandler.success(res, 200, {
			message: "Job status retrieved",
			data: {
				jobId,
				state,
				progress,
				result,
				failedReason,
				attemptsMade,
				maxAttempts,
				remainingAttempts: maxAttempts - attemptsMade,
				isRetryable: state === "failed" ? isRetryable : undefined,
				canRetry: state === "failed" && attemptsMade < maxAttempts,
			},
		})
	})

	static getActiveJobForBookmark = asyncHandler(
		async (req: Request, res: Response) => {
			if (!req.userId) {
				return ResponseHandler.error(res, 401, "Unauthorized")
			}

			const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")
			const bookmarkId = req.params.id

			if (!bookmarkId) {
				return ResponseHandler.error(res, 400, "Bookmark ID is required")
			}

			const waitingJobs = await bookmarkQueue.getWaiting(0, 1000)
			const activeJobs = await bookmarkQueue.getActive(0, 1000)

			const allJobs = [...waitingJobs, ...activeJobs]

			const bookmarkJobs = allJobs.filter(
				(job) =>
					job.data.bookmarkId === bookmarkId && job.data.userId === req.userId
			)

			const job = bookmarkJobs[0]
			if (!job) {
				return ResponseHandler.success(res, 200, {
					message: "No active job found for bookmark",
					data: null,
				})
			}

			const state = await job.getState()
			const progress = typeof job.progress === "number" ? job.progress : 0
			const result = job.returnvalue as {
				bookmarkId?: string
				tags?: string[]
				summary?: string
				attempts?: number
			} | null
			const failedReason =
				typeof job.failedReason === "string" ? job.failedReason : null
			const attemptsMade =
				typeof job.attemptsMade === "number" ? job.attemptsMade : 0
			const maxAttempts =
				typeof job.opts.attempts === "number" ? job.opts.attempts : 5
			const isRetryable = failedReason
				? !failedReason.includes("Permanent failure")
				: false

			ResponseHandler.success(res, 200, {
				message: "Active job found",
				data: {
					jobId: job.id || "",
					state,
					progress,
					result,
					failedReason,
					attemptsMade,
					maxAttempts,
					remainingAttempts: maxAttempts - attemptsMade,
					isRetryable: state === "failed" ? isRetryable : undefined,
					canRetry: state === "failed" && attemptsMade < maxAttempts,
				},
			})
		}
	)

	static retryTagJob = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")
		const jobId = req.params.jobId

		if (!jobId) {
			return ResponseHandler.error(res, 400, "Job ID is required")
		}

		const job = await bookmarkQueue.getJob(jobId)

		if (!job) {
			return ResponseHandler.error(res, 404, "Job not found")
		}

		const state = await job.getState()
		const attemptsMade = job.attemptsMade || 0
		const maxAttempts = job.opts.attempts || 5

		if (state !== "failed") {
			return ResponseHandler.error(res, 400, "Job is not in failed state")
		}

		if (attemptsMade >= maxAttempts) {
			return ResponseHandler.error(
				res,
				400,
				"Job has exceeded maximum retry attempts"
			)
		}

		await job.retry()

		logger.info("Bookmark tag job retried", {
			jobId,
			userId: req.userId,
			previousAttempts: attemptsMade,
		})

		ResponseHandler.success(res, 200, {
			message: "Job retry initiated",
			data: {
				jobId,
				state: "waiting",
				attemptsMade: attemptsMade + 1,
				maxAttempts,
			},
		})
	})

	static getQueueStats = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")

		const counts = await bookmarkQueue.getJobCounts()

		ResponseHandler.success(res, 200, {
			message: "Queue statistics retrieved",
			data: {
				waiting: counts.waiting || 0,
				active: counts.active || 0,
				completed: counts.completed || 0,
				failed: counts.failed || 0,
				delayed: counts.delayed || 0,
				total:
					(counts.waiting || 0) +
					(counts.active || 0) +
					(counts.completed || 0) +
					(counts.failed || 0) +
					(counts.delayed || 0),
			},
		})
	})

	static getFailedJobs = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			return ResponseHandler.error(res, 401, "Unauthorized")
		}

		const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")
		const start = parseInt(req.query.start as string) || 0
		const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

		const failedJobs = await bookmarkQueue.getFailed(start, start + limit - 1)

		const jobs = await Promise.all(
			failedJobs.map(async (job) => {
				const state = await job.getState()
				const jobId = job.id
				const bookmarkId = job.data.bookmarkId
				const attemptsMade = job.attemptsMade || 0
				const maxAttempts =
					typeof job.opts.attempts === "number" ? job.opts.attempts : 5
				const failedReason =
					typeof job.failedReason === "string" ? job.failedReason : null
				const finishedOn =
					typeof job.finishedOn === "number" ? job.finishedOn : null
				const timestamp =
					typeof job.timestamp === "number" ? job.timestamp : null

				return {
					jobId: jobId || null,
					bookmarkId,
					attemptsMade,
					maxAttempts,
					failedReason,
					failedAt: finishedOn ? new Date(finishedOn) : null,
					createdAt: timestamp ? new Date(timestamp) : null,
					state,
				}
			})
		)

		const totalFailed = (await bookmarkQueue.getJobCounts()).failed || 0

		ResponseHandler.success(res, 200, {
			message: "Failed jobs retrieved",
			data: {
				jobs,
				pagination: {
					start,
					limit,
					total: totalFailed,
					hasMore: start + limit < totalFailed,
				},
			},
		})
	})

	static getCompletedJobs = asyncHandler(
		async (req: Request, res: Response) => {
			if (!req.userId) {
				return ResponseHandler.error(res, 401, "Unauthorized")
			}

			const { bookmarkQueue } = await import("../queues/bookmarkQueue.js")
			const start = parseInt(req.query.start as string) || 0
			const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

			const completedJobs = await bookmarkQueue.getCompleted(
				start,
				start + limit - 1
			)

			const jobs = await Promise.all(
				completedJobs.map(async (job) => {
					const state = await job.getState()
					const jobId = job.id
					const bookmarkId = job.data.bookmarkId
					const returnvalue = job.returnvalue as {
						bookmarkId?: string
						tags?: string[]
						summary?: string
						attempts?: number
					} | null
					const finishedOn =
						typeof job.finishedOn === "number" ? job.finishedOn : null
					const processedOn =
						typeof job.processedOn === "number" ? job.processedOn : null
					const timestamp =
						typeof job.timestamp === "number" ? job.timestamp : null

					return {
						jobId: jobId || null,
						bookmarkId,
						result: returnvalue || null,
						completedAt: finishedOn ? new Date(finishedOn) : null,
						createdAt: timestamp ? new Date(timestamp) : null,
						processedIn:
							finishedOn && processedOn ? finishedOn - processedOn : null,
						state,
					}
				})
			)

			const totalCompleted = (await bookmarkQueue.getJobCounts()).completed || 0

			ResponseHandler.success(res, 200, {
				message: "Completed jobs retrieved",
				data: {
					jobs,
					pagination: {
						start,
						limit,
						total: totalCompleted,
						hasMore: start + limit < totalCompleted,
					},
				},
			})
		}
	)
}
