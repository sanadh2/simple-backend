import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import type { RedisReply } from "rate-limit-redis"
import { RedisStore } from "rate-limit-redis"

import { env } from "../config/env.js"
import { redisConnection } from "../config/redis.js"
import { logger } from "../utils/logger.js"

/**
 * Helper function to create a sendCommand function for RedisStore
 * This adapts ioredis call method to the format expected by rate-limit-redis
 */
function createSendCommand() {
	return async (
		command: string,
		...args: (string | number)[]
	): Promise<RedisReply> => {
		const result = await redisConnection.call(command, ...args)
		return result as RedisReply
	}
}

/**
 * Global rate limiter - applies to all requests
 * Limits: 1000 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 1000, // Limit each IP to 1000 requests per windowMs
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:global:",
	}),
	message: {
		success: false,
		message:
			"Too many requests from this IP (max 1000 per 15 min), please try again later",
	},
	skip: (_req) => {
		// Skip rate limiting in test environment
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
	handler: (req, res) => {
		logger.warn("Global rate limit exceeded", {
			ip: req.ip,
			url: req.originalUrl,
			method: req.method,
			userAgent: req.headers["user-agent"],
		})
		res.status(429).json({
			success: false,
			message:
				"Too many requests from this IP (max 1000 per 15 min), please try again later",
		})
	},
})

/**
 * Strict rate limiter for authentication endpoints
 * Limits: 20 requests per 15 minutes per IP
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20, // Limit each IP to 20 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:auth:",
	}),
	message: {
		success: false,
		message:
			"Too many authentication attempts (max 20 per 15 min), please try again later",
	},
	skipSuccessfulRequests: true, // Don't count successful requests
	skip: () => {
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
	handler: (req, res) => {
		const userAgentHeader = req.headers["user-agent"]
		const email =
			req.body && typeof req.body === "object" && "email" in req.body
				? (req.body as { email: string }).email
				: undefined

		logger.warn("Auth rate limit exceeded", {
			ip: req.ip,
			url: req.originalUrl,
			method: req.method,
			email,
			userAgent:
				typeof userAgentHeader === "string" ? userAgentHeader : undefined,
		})
		res.status(429).json({
			success: false,
			message:
				"Too many authentication attempts (max 20 per 15 min), please try again later",
		})
	},
})

/**
 * API rate limiter for general API endpoints
 * Limits: 200 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 200, // Limit each IP to 200 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:api:",
	}),
	message: {
		success: false,
		message:
			"Too many API requests (max 200 per 15 min), please try again later",
	},
	skip: (_req) => {
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
})

/**
 * Strict rate limiter for password reset and registration endpoints
 * Limits: 10 requests per hour per IP
 */
export const strictLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 10, // Limit each IP to 10 requests per hour
	standardHeaders: true,
	legacyHeaders: false,
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:strict:",
	}),
	message: {
		success: false,
		message: "Too many requests (max 10 per hour), please try again later",
	},
	skip: (_req) => {
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
})

/**
 * Password reset request limiter - prevents email enumeration and spam
 * Limits: 5 requests per hour per email address
 * Uses email from request body as key instead of IP
 */
export const passwordResetRequestLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // Limit each email to 5 requests per hour
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => {
		const email =
			req.body && typeof req.body === "object" && "email" in req.body
				? (req.body as { email: string }).email?.toLowerCase()
				: null
		if (email) {
			return `password-reset-request:${email}`
		}
		const ip = req.ip || req.socket.remoteAddress || "unknown"
		return `password-reset-request:${ipKeyGenerator(ip)}`
	},
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:pw-reset-req:",
	}),
	message: {
		success: false,
		message:
			"Too many password reset requests for this email (max 5 per hour), please try again later",
	},
	skip: (_req) => {
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
	handler: (req, res) => {
		const email =
			req.body && typeof req.body === "object" && "email" in req.body
				? (req.body as { email: string }).email
				: undefined

		logger.warn("Password reset request rate limit exceeded", {
			ip: req.ip,
			email,
			url: req.originalUrl,
			method: req.method,
		})
		res.status(429).json({
			success: false,
			message:
				"Too many password reset requests for this email (max 5 per hour), please try again later",
		})
	},
})

/**
 * Password reset attempt limiter - prevents brute force OTP attacks
 * Limits: 10 attempts per hour per email address
 */
export const passwordResetAttemptLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 10, // Limit each email to 10 reset attempts per hour
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => {
		const email =
			req.body && typeof req.body === "object" && "email" in req.body
				? (req.body as { email: string }).email?.toLowerCase()
				: null
		if (email) {
			return `password-reset-attempt:${email}`
		}
		const ip = req.ip || req.socket.remoteAddress || "unknown"
		return `password-reset-attempt:${ipKeyGenerator(ip)}`
	},
	store: new RedisStore({
		sendCommand: createSendCommand(),
		prefix: "rl:pw-reset-attempt:",
	}),
	message: {
		success: false,
		message:
			"Too many password reset attempts for this email (max 10 per hour), please try again later",
	},
	skipSuccessfulRequests: true, // Don't count successful resets
	skip: (_req) => {
		return env.NODE_ENV === "test" || env.NODE_ENV === "development"
	},
	handler: (req, res) => {
		const email =
			req.body && typeof req.body === "object" && "email" in req.body
				? (req.body as { email: string }).email
				: undefined

		logger.warn("Password reset attempt rate limit exceeded", {
			ip: req.ip,
			email,
			url: req.originalUrl,
			method: req.method,
		})
		res.status(429).json({
			success: false,
			message:
				"Too many password reset attempts for this email (max 10 per hour), please try again later",
		})
	},
})
