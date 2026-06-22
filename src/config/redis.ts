import { Redis, type RedisOptions } from "ioredis"

import { logger } from "../utils/logger.js"
import { env } from "./env.js"

export const createRedisConnection = () => {
	const config: RedisOptions = {
		host: env.REDIS_HOST || "localhost",
		port: env.REDIS_PORT || 6379,
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
		// Keep retrying forever with a capped backoff so the app stays up and
		// reconnects automatically once Redis becomes available again.
		retryStrategy: (times) => Math.min(times * 200, 5000),
	}

	if (env.REDIS_PASSWORD) {
		config.password = env.REDIS_PASSWORD
	}

	return new Redis(config)
}

export const redisConnection = createRedisConnection()

// Tracks whether Redis is currently reachable so we only log connection
// failures once per outage instead of on every reconnect attempt.
let redisAvailable = false
let hasLoggedOutage = false

redisConnection.on("ready", () => {
	redisAvailable = true
	hasLoggedOutage = false
	logger.info("✓ Redis connected successfully", undefined, true)
})

redisConnection.on("error", (error: Error) => {
	// Only log the first error of an outage to avoid flooding the logs while
	// ioredis keeps retrying in the background. The app keeps running with
	// Redis-backed features (rate limiting, queues) degraded until it recovers.
	if (!hasLoggedOutage) {
		hasLoggedOutage = true
		logger.error(
			"Redis connection error — the app will keep running with Redis features degraded",
			error,
			undefined,
			true
		)
	}
	redisAvailable = false
})

redisConnection.on("end", () => {
	redisAvailable = false
})

export const isRedisAvailable = () => redisAvailable
