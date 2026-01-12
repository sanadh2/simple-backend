import type { NextFunction, Request, Response } from "express"

import { type IUser, User } from "../models/User.js"
import { AuthService } from "../services/authService.js"
import { Logger, logger } from "../utils/logger.js"
import { AppError, asyncHandler } from "./errorHandler.js"

// Extend Express Request type to include user
declare module "express-serve-static-core" {
	interface Request {
		user?: IUser
		userId?: string
	}
}

/**
 * Middleware to verify JWT access token
 * Adds user object to request if token is valid
 */
export const authenticate = asyncHandler(
	async (req: Request, _res: Response, next: NextFunction) => {
		// Extract token from Authorization header
		const token = AuthService.extractTokenFromHeader(req.headers.authorization)

		if (!token) {
			throw new AppError(
				"Authentication required. Please provide a valid token.",
				401
			)
		}

		// Verify token
		const decoded = AuthService.verifyAccessToken(token)

		// Get user from database
		const user = await User.findById(decoded.userId)

		if (!user) {
			throw new AppError("User not found. Token may be invalid.", 401)
		}

		// Check if all tokens were invalidated after this token was issued
		if (user.tokensInvalidatedAt && decoded.iat) {
			const tokenIssuedAt = new Date(decoded.iat * 1000)
			if (tokenIssuedAt < user.tokensInvalidatedAt) {
				logger.warn("Revoked token used", {
					userId: user._id.toString(),
					tokenIssuedAt,
					tokensInvalidatedAt: user.tokensInvalidatedAt,
				})
				throw new AppError("Token has been revoked. Please login again.", 401)
			}
		}

		// Attach user to request object
		req.user = user
		req.userId = user._id.toString()

		// Add userId to logging context
		Logger.setContext({ userId: user._id.toString() })

		next()
	}
)

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't throw error if token is missing
 */
export const optionalAuthenticate = asyncHandler(
	async (req: Request, _res: Response, next: NextFunction) => {
		const token = AuthService.extractTokenFromHeader(req.headers.authorization)

		if (token) {
			try {
				const decoded = AuthService.verifyAccessToken(token)
				const user = await User.findById(decoded.userId)

				if (user) {
					// Check if all tokens were invalidated after this token was issued
					if (user.tokensInvalidatedAt && decoded.iat) {
						const tokenIssuedAt = new Date(decoded.iat * 1000)
						if (tokenIssuedAt < user.tokensInvalidatedAt) {
							// Token was revoked, skip authentication
							return next()
						}
					}

					req.user = user
					req.userId = user._id.toString()
				}
			} catch {
				// Silently fail for optional authentication
			}
		}

		next()
	}
)

/**
 * Middleware to check if user email is verified
 */
export const requireEmailVerified = (
	req: Request,
	_res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		throw new AppError("Authentication required", 401)
	}

	if (!req.user.isEmailVerified) {
		throw new AppError(
			"Email verification required to access this resource",
			403
		)
	}

	next()
}
