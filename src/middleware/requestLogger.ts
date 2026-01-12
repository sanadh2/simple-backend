import type { NextFunction, Request, Response } from "express"

import { logger } from "../utils/logger.js"

export const requestLoggerMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const startTime = Date.now()

	res.on("finish", () => {
		const duration = Date.now() - startTime
		const { method, originalUrl, ip } = req
		const { statusCode } = res

		const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`

		if (statusCode >= 500) {
			logger.error(logMessage, {
				method,
				url: originalUrl,
				statusCode,
				duration,
				ip,
			})
		} else if (statusCode >= 400) {
			logger.warn(logMessage, {
				method,
				url: originalUrl,
				statusCode,
				duration,
				ip,
			})
		} else {
			logger.info(logMessage, {
				method,
				url: originalUrl,
				statusCode,
				duration,
				ip,
			})
		}
	})

	next()
}
