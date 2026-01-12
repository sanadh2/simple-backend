import { Redis } from "ioredis"

import { env } from "./env.js"

export const createRedisConnection = () => {
	const config: {
		host: string
		port: number
		password?: string
		maxRetriesPerRequest: null
		enableReadyCheck: boolean
	} = {
		host: env.REDIS_HOST || "localhost",
		port: env.REDIS_PORT || 6379,
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	}

	if (env.REDIS_PASSWORD) {
		config.password = env.REDIS_PASSWORD
	}

	return new Redis(config)
}

export const redisConnection = createRedisConnection()

redisConnection.on("connect", () => {
	console.log("✓ Redis connected successfully")
})

redisConnection.on("error", (error) => {
	console.error("Redis connection error:", error)
})
