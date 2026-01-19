import type { NextFunction, Request, Response } from "express"

import { type IUser, User } from "../models/index.js"
import { AuthService } from "../services/index.js"
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
		logger.debug("Authentication middleware started", {
			url: req.originalUrl,
			method: req.method,
			hasCookies: !!req.cookies,
			hasAuthHeader: !!req.headers.authorization,
		})

		// Extract token from cookie first (httpOnly), then fallback to Authorization header
		let token: string | null = null
		let tokenSource: "cookie" | "header" | "none" = "none"

		if (req.cookies?.accessToken) {
			token = req.cookies.accessToken as string
			tokenSource = "cookie"
			logger.debug("Token found in cookie", {
				tokenLength: token.length,
			})
		}

		if (!token) {
			token = AuthService.extractTokenFromHeader(req.headers.authorization)
			if (token) {
				tokenSource = "header"
				logger.debug("Token found in Authorization header", {
					tokenLength: token.length,
				})
			}
		}

		if (!token) {
			logger.warn("Authentication failed: No token provided", {
				url: req.originalUrl,
				method: req.method,
				ip: req.ip,
			})
			throw new AppError(
				"Authentication required. Please provide a valid token.",
				401
			)
		}

		logger.debug("Token extracted, verifying...", {
			tokenSource,
			tokenLength: token.length,
		})

		// Verify token
		let decoded
		try {
			decoded = AuthService.verifyAccessToken(token)
			logger.debug("Token verified successfully", {
				userId: decoded.userId,
				email: decoded.email,
				tokenType: decoded.type,
			})
		} catch (error) {
			logger.warn("Token verification failed", {
				error: error instanceof Error ? error.message : "Unknown error",
				url: req.originalUrl,
			})
			throw error
		}

		// Get user from database
		logger.debug("Fetching user from database", {
			userId: decoded.userId,
		})
		const user = await User.findById(decoded.userId)

		if (!user) {
			logger.error("User not found for authenticated token", {
				userId: decoded.userId,
				email: decoded.email,
			})
			throw new AppError("User not found. Token may be invalid.", 401)
		}

		logger.debug("User found, checking token validity", {
			userId: user._id.toString(),
			email: user.email,
			hasTokensInvalidatedAt: !!user.tokens_invalidated_at,
		})

		// Check if all tokens were invalidated after this token was issued
		if (user.tokens_invalidated_at && decoded.iat) {
			const tokenIssuedAt = new Date(decoded.iat * 1000)
			if (tokenIssuedAt < user.tokens_invalidated_at) {
				logger.warn("Revoked token used", {
					userId: user._id.toString(),
					tokenIssuedAt,
					tokensInvalidatedAt: user.tokens_invalidated_at,
					url: req.originalUrl,
				})
				throw new AppError("Token has been revoked. Please login again.", 401)
			}
		}

		// Attach user to request object
		req.user = user
		req.userId = user._id.toString()

		// Add userId to logging context
		Logger.setContext({ userId: user._id.toString() })

		logger.debug("Authentication successful", {
			userId: user._id.toString(),
			email: user.email,
			url: req.originalUrl,
		})

		next()
	}
)

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't throw error if token is missing
 */
export const optionalAuthenticate = asyncHandler(
	async (req: Request, _res: Response, next: NextFunction) => {
		logger.debug("Optional authentication middleware started", {
			url: req.originalUrl,
			method: req.method,
		})

		let token: string | null = null

		if (req.cookies?.accessToken) {
			token = req.cookies.accessToken as string
			logger.debug("Token found in cookie for optional auth")
		}

		if (!token) {
			token = AuthService.extractTokenFromHeader(req.headers.authorization)
			if (token) {
				logger.debug("Token found in Authorization header for optional auth")
			}
		}

		if (token) {
			try {
				const decoded = AuthService.verifyAccessToken(token)
				logger.debug("Token verified in optional auth", {
					userId: decoded.userId,
				})

				const user = await User.findById(decoded.userId)

				if (user) {
					// Check if all tokens were invalidated after this token was issued
					if (user.tokens_invalidated_at && decoded.iat) {
						const tokenIssuedAt = new Date(decoded.iat * 1000)
						if (tokenIssuedAt < user.tokens_invalidated_at) {
							// Token was revoked, skip authentication
							logger.debug("Token revoked, skipping optional auth")
							return next()
						}
					}

					req.user = user
					req.userId = user._id.toString()
					Logger.setContext({ userId: user._id.toString() })
					logger.debug("Optional authentication successful", {
						userId: user._id.toString(),
					})
				} else {
					logger.debug("User not found for optional auth token")
				}
			} catch (error) {
				// Silently fail for optional authentication
				logger.debug("Optional authentication failed (expected)", {
					error: error instanceof Error ? error.message : "Unknown",
				})
			}
		} else {
			logger.debug("No token provided for optional auth")
		}

		next()
	}
)

export const requireEmailVerified = (
	req: Request,
	_res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		throw new AppError("Authentication required", 401)
	}

	if (!req.user.is_email_verified) {
		throw new AppError(
			"Email verification required to access this resource",
			403
		)
	}

	next()
}
