import { type NextFunction, type Request, type Response } from "express"

import { logger } from "../utils/logger.js"

export class AppError extends Error {
	statusCode: number
	isOperational: boolean

	constructor(message: string, statusCode: number = 500) {
		super(message)
		this.statusCode = statusCode
		this.isOperational = true

		Error.captureStackTrace(this, this.constructor)
	}
}

type AsyncRequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction
) => Promise<void> | void

export const asyncHandler = (fn: AsyncRequestHandler) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next)
	}
}

export const errorHandler = (
	err: Error | AppError,
	req: Request,
	res: Response,
	_next: NextFunction
): void => {
	let statusCode = 500
	let message = "Internal Server Error"

	if (err instanceof AppError) {
		statusCode = err.statusCode
		message = err.message
	} else if (err.name === "ValidationError") {
		statusCode = 400
		message = err.message
	} else if ("code" in err && (err as { code: number }).code === 11000) {
		statusCode = 409
		message = "Duplicate field value entered"
	} else if (err.name === "CastError") {
		statusCode = 400
		message = "Invalid ID format"
	} else if (err.name === "JsonWebTokenError") {
		statusCode = 401
		message = "Invalid token"
	} else if (err.name === "TokenExpiredError") {
		statusCode = 401
		message = "Token expired"
	}

	const logMeta = {
		statusCode,
		method: req.method,
		url: req.originalUrl,
		ip: req.ip,
		correlationId: (req as Request & { correlationId?: string }).correlationId,
		userId: (req as Request & { userId?: string }).userId,
		errorName: err.name,
		errorStack: err instanceof Error ? err.stack : undefined,
	}

	logger.debug("Error handler invoked", {
		statusCode,
		message,
		errorName: err.name,
		url: req.originalUrl,
	})

	if (statusCode >= 500) {
		logger.error(message, err, logMeta)
	} else if (statusCode >= 400) {
		logger.warn(message, logMeta)
	} else {
		logger.debug("Error handled (non-4xx/5xx)", logMeta)
	}

	res.status(statusCode).json({
		success: false,
		message,
	})
}

export const notFoundHandler = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	logger.warn("Route not found", {
		method: req.method,
		url: req.originalUrl,
		ip: req.ip,
	})
	const error = new AppError(`Route not found - ${req.originalUrl}`, 404)
	next(error)
}
