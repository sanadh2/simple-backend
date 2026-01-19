import type { NextFunction, Request, Response } from "express"

import { logger } from "../utils/logger.js"

export const requestLoggerMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Skip logging for OPTIONS requests (CORS preflight)
	if (req.method === "OPTIONS") {
		return next()
	}

	const startTime = Date.now()
	const { method, originalUrl, ip, headers, query } = req

	// Log incoming request with detailed information
	const userAgent = headers["user-agent"]
	const contentType = headers["content-type"]
	const contentLength = headers["content-length"]

	logger.debug("Incoming request", {
		method,
		url: originalUrl,
		ip,
		userAgent: typeof userAgent === "string" ? userAgent : undefined,
		contentType: typeof contentType === "string" ? contentType : undefined,
		contentLength:
			typeof contentLength === "string" ? contentLength : undefined,
		query: Object.keys(query).length > 0 ? query : undefined,
		hasBody:
			!!req.body && Object.keys(req.body as Record<string, unknown>).length > 0,
		correlation_id: req.correlation_id,
	})

	res.on("finish", () => {
		const duration = Date.now() - startTime
		const { statusCode } = res
		const responseSize = res.get("content-length") || "unknown"

		const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`

		const userAgentHeader = headers["user-agent"]
		const logMeta: Record<string, unknown> = {
			method,
			url: originalUrl,
			statusCode,
			duration,
			ip,
			responseSize,
			userAgent:
				typeof userAgentHeader === "string" ? userAgentHeader : undefined,
			correlation_id: req.correlation_id,
			userId: (req as Request & { userId?: string }).userId,
		}

		if (statusCode >= 500) {
			logger.error(logMessage, undefined, logMeta)
		} else if (statusCode >= 400) {
			logger.warn(logMessage, logMeta)
		} else {
			logger.info(logMessage, logMeta)
		}

		// Debug log for slow requests
		if (duration > 1000) {
			logger.warn("Slow request detected", {
				...logMeta,
				threshold: "1000ms",
			})
		}
	})

	next()
}
