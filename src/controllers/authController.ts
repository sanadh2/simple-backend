import type { CookieOptions, Request, Response } from "express"
import { z } from "zod"

import { env } from "../config/env.js"
import { AppError, asyncHandler } from "../middleware/errorHandler.js"
import { User } from "../models/User.js"
import { AuthService } from "../services/authService.js"
import { Logger, logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

// Validation schemas
const registerSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	firstName: z.string().min(1, "First name is required").trim(),
	lastName: z.string().min(1, "Last name is required").trim(),
})

const loginSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
})

const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
})

const logoutSchema = z.object({
	refreshToken: z.string().optional(),
})

const cookieOptions: CookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: env.NODE_ENV === "production" ? "none" : "lax",
	path: "/",
}

export class AuthController {
	/**
	 * Register a new user
	 * POST /api/auth/register
	 */
	static register = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Registration request received", {
			email: (req.body as { email?: string }).email,
			hasFirstName: !!(req.body as { firstName?: string }).firstName,
			hasLastName: !!(req.body as { lastName?: string }).lastName,
		})

		// Validate request body
		let validatedData
		try {
			validatedData = registerSchema.parse(req.body)
			logger.debug("Registration data validated successfully", {
				email: validatedData.email,
			})
		} catch (error) {
			logger.warn("Registration validation failed", {
				error: error instanceof Error ? error.message : "Unknown",
				email: (req.body as { email?: string }).email,
			})
			throw error
		}

		// Check if user already exists
		logger.debug("Checking if user already exists", {
			email: validatedData.email,
		})
		const existingUser = await User.findOne({ email: validatedData.email })
		if (existingUser) {
			logger.warn("Registration attempt with existing email", {
				email: validatedData.email,
				existingUserId: existingUser._id.toString(),
			})
			throw new AppError("User with this email already exists", 409)
		}

		logger.debug("Creating new user", {
			email: validatedData.email,
		})

		// Create new user
		const user = await User.create({
			email: validatedData.email,
			password: validatedData.password,
			firstName: validatedData.firstName,
			lastName: validatedData.lastName,
		})

		logger.debug("User created, generating auth tokens", {
			userId: user._id.toString(),
			email: user.email,
		})

		// Generate auth tokens
		const tokens = await AuthService.generateAuthTokens(user)

		logger.debug("Auth tokens generated", {
			userId: user._id.toString(),
			hasAccessToken: !!tokens.accessToken,
			hasRefreshToken: !!tokens.refreshToken,
		})

		if (req.session) {
			req.session.refreshToken = tokens.refreshToken
			req.session.userId = user._id.toString()
		}

		res.cookie("refreshToken", tokens.refreshToken, {
			...cookieOptions,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		})

		res.cookie("accessToken", tokens.accessToken, {
			...cookieOptions,
			maxAge: 15 * 60 * 1000,
		})

		Logger.setContext({ userId: user._id.toString() })
		logger.info("User registered successfully", {
			email: user.email,
			userId: user._id.toString(),
		})

		ResponseHandler.success(res, 201, {
			message: "User registered successfully",
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					isEmailVerified: user.isEmailVerified,
				},
			},
		})
	})

	static login = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Login request received", {
			email: (req.body as { email?: string }).email,
			hasPassword: !!(req.body as { password?: string }).password,
		})

		let validatedData
		try {
			validatedData = loginSchema.parse(req.body)
			logger.debug("Login data validated successfully", {
				email: validatedData.email,
			})
		} catch (error) {
			logger.warn("Login validation failed", {
				error: error instanceof Error ? error.message : "Unknown",
				email: (req.body as { email?: string }).email,
			})
			throw error
		}

		// Find user by email (include password field)
		logger.debug("Looking up user by email", {
			email: validatedData.email,
		})
		const user = await User.findOne({ email: validatedData.email }).select(
			"+password"
		)

		if (!user) {
			logger.warn("Login attempt with non-existent email", {
				email: validatedData.email,
				ip: req.ip,
			})
			throw new AppError("Invalid email or password", 401)
		}

		logger.debug("User found, verifying password", {
			userId: user._id.toString(),
			email: user.email,
		})

		// Check password
		const isPasswordValid = await user.comparePassword(validatedData.password)

		if (!isPasswordValid) {
			logger.warn("Login attempt with invalid password", {
				email: validatedData.email,
				userId: user._id.toString(),
				ip: req.ip,
			})
			throw new AppError("Invalid email or password", 401)
		}

		logger.debug("Password verified, generating auth tokens", {
			userId: user._id.toString(),
		})

		// Generate auth tokens
		const tokens = await AuthService.generateAuthTokens(user)

		logger.debug("Auth tokens generated for login", {
			userId: user._id.toString(),
		})

		if (req.session) {
			req.session.refreshToken = tokens.refreshToken
			req.session.userId = user._id.toString()
		}

		res.cookie("refreshToken", tokens.refreshToken, {
			...cookieOptions,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		})

		res.cookie("accessToken", tokens.accessToken, {
			...cookieOptions,
			maxAge: 15 * 60 * 1000,
		})

		Logger.setContext({ userId: user._id.toString() })
		logger.info("User logged in successfully", {
			email: user.email,
			userId: user._id.toString(),
		})

		ResponseHandler.success(res, 200, {
			message: "Login successful",
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					isEmailVerified: user.isEmailVerified,
				},
			},
		})
	})

	/**
	 * Logout user
	 * POST /api/auth/logout
	 */
	static logout = asyncHandler(async (req: Request, res: Response) => {
		const validatedBody = logoutSchema.parse(req.body)
		const bodyToken = validatedBody.refreshToken
		let sessionToken: string | undefined
		let cookieToken: string | undefined

		if (req.session) {
			sessionToken = req.session.refreshToken
		}

		if (req.cookies) {
			cookieToken = req.cookies.refreshToken as string | undefined
		}

		const refreshToken = bodyToken || cookieToken || sessionToken

		if (refreshToken && req.userId) {
			await AuthService.revokeRefreshToken(req.userId, refreshToken)
		}

		res.clearCookie("refreshToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
		})

		if (req.session) {
			req.session.destroy((err: Error | null) => {
				if (err) {
					throw new AppError("Failed to logout", 500)
				}
			})
		}

		res.clearCookie("refreshToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
		})

		res.clearCookie("accessToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
		})

		if (req.userId) {
			logger.info("User logged out", { userId: req.userId })
		}

		ResponseHandler.success(res, 200, {
			message: "Logout successful",
		})
	})

	/**
	 * Logout from all devices
	 * POST /api/auth/logout-all
	 */
	static logoutAll = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			throw new AppError("Authentication required", 401)
		}

		await AuthService.revokeAllRefreshTokens(req.userId)

		res.clearCookie("refreshToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
		})

		res.clearCookie("accessToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
		})

		if (req.session) {
			req.session.destroy((err: Error | null) => {
				if (err) {
					throw new AppError("Failed to logout", 500)
				}
			})
		}

		logger.info("User logged out from all devices", { userId: req.userId })

		ResponseHandler.success(res, 200, {
			message: "Logged out from all devices successfully",
		})
	})

	/**
	 * Refresh access token
	 * POST /api/auth/refresh
	 */
	static refreshToken = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Token refresh request received", {
			hasCookies: !!req.cookies,
			hasBody: !!req.body,
			hasSession: !!req.session,
		})

		let cookieToken: string | undefined
		let bodyToken: string | undefined
		let sessionToken: string | undefined

		if (req.cookies) {
			cookieToken = req.cookies.refreshToken as string | undefined
			if (cookieToken) {
				logger.debug("Refresh token found in cookie")
			}
		}

		if (
			req.body &&
			typeof req.body === "object" &&
			"refreshToken" in req.body
		) {
			try {
				const validatedBody = refreshTokenSchema.parse(req.body)
				bodyToken = validatedBody.refreshToken
				if (bodyToken) {
					logger.debug("Refresh token found in request body")
				}
			} catch {
				bodyToken = undefined
				logger.debug("Refresh token validation failed in body")
			}
		}

		if (req.session) {
			sessionToken = req.session.refreshToken
			if (sessionToken) {
				logger.debug("Refresh token found in session")
			}
		}

		const refreshToken = cookieToken || bodyToken || sessionToken

		if (!refreshToken) {
			logger.warn("Token refresh failed: No refresh token provided", {
				ip: req.ip,
			})
			throw new AppError("Refresh token is required", 400)
		}

		logger.debug("Refreshing access token", {
			tokenLength: refreshToken.length,
			tokenSource: cookieToken ? "cookie" : bodyToken ? "body" : "session",
		})

		const accessToken = await AuthService.refreshAccessToken(refreshToken)

		logger.debug("Access token refreshed successfully", {
			hasAccessToken: !!accessToken,
		})

		res.cookie("accessToken", accessToken, cookieOptions)

		ResponseHandler.success(res, 200, {
			message: "Token refreshed successfully",
			data: {
				accessToken,
			},
		})
	})

	/**
	 * Get current user profile
	 * GET /api/auth/me
	 */
	static getProfile = asyncHandler((_req: Request, res: Response) => {
		if (!res.req.user) {
			throw new AppError("Authentication required", 401)
		}

		const user = res.req.user

		ResponseHandler.success(res, 200, {
			message: "User profile retrieved successfully",
			data: {
				user: {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					isEmailVerified: user.isEmailVerified,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			},
		})
	})
}
