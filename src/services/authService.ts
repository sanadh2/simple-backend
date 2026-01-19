import jwt, { type SignOptions } from "jsonwebtoken"
import type { StringValue } from "ms"

import { env } from "../config/env.js"
import { AppError } from "../middleware/errorHandler.js"
import { type IUser, User } from "../models/index.js"
import { logger } from "../utils/logger.js"

export interface TokenPayload {
	userId: string
	email: string
	type: "access" | "refresh"
	iat?: number
	exp?: number
}

export interface AuthTokens {
	accessToken: string
	refreshToken: string
}

export class AuthService {
	/**
	 * Generate access token (short-lived)
	 */
	static generateAccessToken(userId: string, email: string): string {
		const payload: TokenPayload = {
			userId,
			email,
			type: "access",
		}

		const options: SignOptions = {
			expiresIn: env.JWT_ACCESS_EXPIRY as StringValue,
		}

		return jwt.sign(payload, env.JWT_ACCESS_SECRET, options)
	}

	/**
	 * Generate refresh token (long-lived)
	 */
	static generateRefreshToken(userId: string, email: string): string {
		const payload: TokenPayload = {
			userId,
			email,
			type: "refresh",
		}

		const options: SignOptions = {
			expiresIn: env.JWT_REFRESH_EXPIRY as StringValue,
		}

		return jwt.sign(payload, env.JWT_REFRESH_SECRET, options)
	}

	/**
	 * Generate both access and refresh tokens
	 */
	static async generateAuthTokens(user: IUser): Promise<AuthTokens> {
		logger.debug("Generating auth tokens", {
			userId: user._id.toString(),
			email: user.email,
		})

		const accessToken = this.generateAccessToken(
			user._id.toString(),
			user.email
		)
		const refreshToken = this.generateRefreshToken(
			user._id.toString(),
			user.email
		)

		logger.debug("Tokens generated, storing refresh token in database", {
			userId: user._id.toString(),
		})

		// Store refresh token in database
		await User.findByIdAndUpdate(user._id, {
			$push: { refreshTokens: refreshToken },
		})

		logger.debug("Refresh token stored successfully", {
			userId: user._id.toString(),
		})

		return {
			accessToken,
			refreshToken,
		}
	}

	/**
	 * Verify access token
	 */
	static verifyAccessToken(token: string): TokenPayload {
		logger.debug("Verifying access token", {
			tokenLength: token.length,
		})

		try {
			const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload

			if (decoded.type !== "access") {
				logger.warn("Invalid token type for access token", {
					tokenType: decoded.type,
				})
				throw new AppError("Invalid token type", 401)
			}

			logger.debug("Access token verified successfully", {
				userId: decoded.userId,
				email: decoded.email,
			})

			return decoded
		} catch (error) {
			if (error instanceof jwt.JsonWebTokenError) {
				logger.warn("Invalid access token", {
					error: error.message,
				})
				throw new AppError("Invalid token", 401)
			}
			if (error instanceof jwt.TokenExpiredError) {
				logger.warn("Access token expired", {
					expiredAt: error.expiredAt,
				})
				throw new AppError("Token expired", 401)
			}
			logger.error("Unexpected error verifying access token", error)
			throw error
		}
	}

	/**
	 * Verify refresh token
	 */
	static verifyRefreshToken(token: string): TokenPayload {
		try {
			const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload

			if (decoded.type !== "refresh") {
				throw new AppError("Invalid token type", 401)
			}

			return decoded
		} catch (error) {
			if (error instanceof jwt.JsonWebTokenError) {
				throw new AppError("Invalid refresh token", 401)
			}
			if (error instanceof jwt.TokenExpiredError) {
				throw new AppError("Refresh token expired", 401)
			}
			throw error
		}
	}

	/**
	 * Refresh access token using refresh token
	 */
	static async refreshAccessToken(refreshToken: string): Promise<string> {
		logger.debug("Refreshing access token", {
			refreshTokenLength: refreshToken.length,
		})

		// Verify refresh token
		const decoded = this.verifyRefreshToken(refreshToken)

		logger.debug("Refresh token verified, checking in database", {
			userId: decoded.userId,
		})

		// Check if refresh token exists in database
		const user = await User.findOne({
			_id: decoded.userId,
			refreshTokens: refreshToken,
		})

		if (!user) {
			logger.warn("Refresh token not found in database", {
				userId: decoded.userId,
			})
			throw new AppError("Invalid refresh token", 401)
		}

		logger.debug(
			"Refresh token found in database, generating new access token",
			{
				userId: user._id.toString(),
			}
		)

		// Generate new access token
		const accessToken = this.generateAccessToken(
			user._id.toString(),
			user.email
		)

		logger.debug("New access token generated", {
			userId: user._id.toString(),
		})

		return accessToken
	}

	/**
	 * Revoke a specific refresh token
	 */
	static async revokeRefreshToken(
		userId: string,
		refreshToken: string
	): Promise<void> {
		await User.findByIdAndUpdate(userId, {
			$pull: { refreshTokens: refreshToken },
		})
	}

	/**
	 * Revoke all refresh tokens for a user (logout from all devices)
	 */
	static async revokeAllRefreshTokens(userId: string): Promise<void> {
		await User.findByIdAndUpdate(userId, {
			$set: {
				refreshTokens: [],
				tokensInvalidatedAt: new Date(),
			},
		})
	}

	/**
	 * Extract token from Authorization header
	 */
	static extractTokenFromHeader(authHeader: string | undefined): string | null {
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return null
		}

		return authHeader.substring(7)
	}
}
