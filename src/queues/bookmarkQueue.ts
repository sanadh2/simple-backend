import { Queue } from "bullmq"

import { env } from "../config/env.js"

export interface BookmarkTagJob {
	bookmarkId: string
	userId: string
	url: string
	title: string
	description?: string
	retryCount?: number
	lastError?: string
}

export interface RetryableError extends Error {
	retryable?: boolean
	retryAfter?: number
}

const connection = {
	host: env.REDIS_HOST || "localhost",
	port: env.REDIS_PORT || 6379,
	...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
}

export const bookmarkQueue = new Queue<BookmarkTagJob>("bookmark-tags", {
	connection,
	defaultJobOptions: {
		attempts: 5,
		backoff: {
			type: "exponential",
			delay: 5000,
		},
		removeOnComplete: {
			count: 500,
			age: 24 * 3600,
		},
		removeOnFail: {
			count: 1000,
			age: 7 * 24 * 3600,
		},
	},
})

export const bookmarkFailedQueue = new Queue<BookmarkTagJob>(
	"bookmark-tags-failed",
	{
		connection,
		defaultJobOptions: {
			removeOnComplete: {
				count: 100,
				age: 30 * 24 * 3600,
			},
		},
	}
)

bookmarkQueue.on("error", (error) => {
	console.error("Bookmark queue error:", error)
})
