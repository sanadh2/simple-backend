import { Job, Worker } from "bullmq"
import mongoose from "mongoose"

import { env } from "../config/env.js"
import { Bookmark } from "../models/Bookmark.js"
import type { BookmarkTagJob, RetryableError } from "../queues/bookmarkQueue.js"
import { bookmarkFailedQueue } from "../queues/bookmarkQueue.js"
import { OpenAIService } from "../services/openaiService.js"
import { logger } from "../utils/logger.js"

const connection = {
	host: env.REDIS_HOST || "localhost",
	port: env.REDIS_PORT || 6379,
	...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
}

function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return true

	const errorMessage = error.message.toLowerCase()
	const retryablePatterns = [
		"network",
		"timeout",
		"connection",
		"econnrefused",
		"etimedout",
		"eai_again",
		"temporary",
		"rate limit",
		"too many requests",
		"service unavailable",
		"bad gateway",
		"gateway timeout",
		"no response",
		"empty response",
	]

	const nonRetryablePatterns = [
		"not found",
		"unauthorized",
		"forbidden",
		"invalid",
		"malformed",
		"syntax error",
	]

	if (nonRetryablePatterns.some((pattern) => errorMessage.includes(pattern))) {
		return false
	}

	return retryablePatterns.some((pattern) => errorMessage.includes(pattern))
}

function createRetryableError(
	message: string,
	retryAfter?: number
): RetryableError {
	const error = new Error(message) as RetryableError
	error.retryable = true
	if (retryAfter) {
		error.retryAfter = retryAfter
	}
	return error
}

export const bookmarkWorker = new Worker<BookmarkTagJob>(
	"bookmark-tags",
	async (job: Job<BookmarkTagJob>) => {
		const { data } = job
		const attemptNumber = (job.attemptsMade || 0) + 1

		logger.info("Processing bookmark tag generation", {
			bookmarkId: data.bookmarkId,
			userId: data.userId,
			jobId: job.id,
			attempt: attemptNumber,
			maxAttempts: job.opts.attempts || 5,
		})

		try {
			const bookmark = await Bookmark.findOne({
				_id: new mongoose.Types.ObjectId(data.bookmarkId),
				userId: new mongoose.Types.ObjectId(data.userId),
			})

			if (!bookmark) {
				const error = new Error("Bookmark not found") as RetryableError
				error.retryable = false
				throw error
			}

			const healthCheck = await OpenAIService.checkOllamaHealth()
			if (!healthCheck) {
				throw createRetryableError("Ollama service unavailable", 10000)
			}

			const aiResult = await OpenAIService.generateTags(
				data.url,
				data.title,
				data.description
			)

			if (
				!aiResult.tags ||
				aiResult.tags.length === 0 ||
				aiResult.tags.includes("uncategorized")
			) {
				if (attemptNumber < 3) {
					throw createRetryableError("AI returned uncategorized tags, retrying")
				}
			}

			bookmark.tags = aiResult.tags
			bookmark.aiGenerated = true

			if (!bookmark.description && aiResult.summary) {
				bookmark.description = aiResult.summary
			}

			await bookmark.save()

			logger.info("Bookmark tags generated successfully", {
				bookmarkId: data.bookmarkId,
				tags: aiResult.tags,
				jobId: job.id,
				attempt: attemptNumber,
			})

			return {
				bookmarkId: data.bookmarkId,
				tags: aiResult.tags,
				summary: aiResult.summary,
				attempts: attemptNumber,
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const isRetryable = isRetryableError(error)

			logger.error("Failed to generate bookmark tags", {
				bookmarkId: data.bookmarkId,
				error: errorMessage,
				jobId: job.id,
				attempt: attemptNumber,
				isRetryable,
				willRetry: isRetryable && attemptNumber < (job.opts.attempts || 5),
			})

			if (!isRetryable) {
				const permanentError = new Error(
					`Permanent failure: ${errorMessage}`
				) as RetryableError
				permanentError.retryable = false
				throw permanentError
			}

			if (error instanceof Error && "retryAfter" in error) {
				const retryError = error as RetryableError
				if (retryError.retryAfter) {
					await job.moveToDelayed(Date.now() + retryError.retryAfter)
					throw new Error(
						`Retrying after ${retryError.retryAfter}ms: ${errorMessage}`
					)
				}
			}

			throw error
		}
	},
	{
		connection,
		concurrency: 2,
		limiter: {
			max: 10,
			duration: 60000,
		},
	}
)

bookmarkWorker.on("completed", (job) => {
	logger.info(`Bookmark tag job ${job.id} completed`, {
		bookmarkId: job.data.bookmarkId,
	})
})

bookmarkWorker.on("failed", (job, error) => {
	const attemptsMade = job?.attemptsMade || 0
	const maxAttempts = job?.opts.attempts || 5
	const isPermanentFailure = attemptsMade >= maxAttempts

	logger.error(`Bookmark tag job ${job?.id} failed`, {
		bookmarkId: job?.data.bookmarkId,
		error: error.message,
		attemptsMade,
		maxAttempts,
		isPermanentFailure,
	})

	if (isPermanentFailure && job) {
		;(async () => {
			try {
				await bookmarkFailedQueue.add("permanent-failure", {
					...job.data,
					lastError: error.message,
					retryCount: attemptsMade,
				})

				const bookmark = await Bookmark.findOne({
					_id: new mongoose.Types.ObjectId(job.data.bookmarkId),
					userId: new mongoose.Types.ObjectId(job.data.userId),
				})

				if (
					bookmark &&
					(!bookmark.tags ||
						bookmark.tags.length === 0 ||
						bookmark.tags.includes("uncategorized"))
				) {
					bookmark.tags = ["uncategorized"]
					bookmark.aiGenerated = false
					await bookmark.save()

					logger.warn("Bookmark set to uncategorized after permanent failure", {
						bookmarkId: bookmark._id.toString(),
					})
				}
			} catch (saveError) {
				logger.error("Failed to update bookmark after permanent failure", {
					bookmarkId: job.data.bookmarkId,
					error:
						saveError instanceof Error ? saveError.message : String(saveError),
				})
			}
		})().catch((err) => {
			logger.error("Unhandled error in failed handler", {
				error: err instanceof Error ? err.message : String(err),
			})
		})
	}
})

bookmarkWorker.on("error", (error) => {
	logger.error("Bookmark worker error", { error: error.message })
})

export const startBookmarkWorker = () => {
	console.log("✓ Bookmark worker started")
}

export const stopBookmarkWorker = async () => {
	await bookmarkWorker.close()
	console.log("✓ Bookmark worker stopped")
}
