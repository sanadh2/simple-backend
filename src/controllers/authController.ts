import type { Request, Response } from "express"
import { z } from "zod"

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

export class AuthController {
	/**
	 * Register a new user
	 * POST /api/auth/register
	 */
	static register = asyncHandler(async (req: Request, res: Response) => {
		// Validate request body
		const validatedData = registerSchema.parse(req.body)

		// Check if user already exists
		const existingUser = await User.findOne({ email: validatedData.email })
		if (existingUser) {
			logger.warn("Registration attempt with existing email", {
				email: validatedData.email,
			})
			throw new AppError("User with this email already exists", 409)
		}

		// Create new user
		const user = await User.create({
			email: validatedData.email,
			password: validatedData.password,
			firstName: validatedData.firstName,
			lastName: validatedData.lastName,
		})

		// Generate auth tokens
		const tokens = await AuthService.generateAuthTokens(user)

		if (req.session) {
			req.session.refreshToken = tokens.refreshToken
			req.session.userId = user._id.toString()
		}

		res.cookie("refreshToken", tokens.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
			path: "/",
		})

		res.cookie("accessToken", tokens.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 15 * 60,
			path: "/",
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
		const validatedData = loginSchema.parse(req.body)

		// Find user by email (include password field)
		const user = await User.findOne({ email: validatedData.email }).select(
			"+password"
		)

		if (!user) {
			logger.warn("Login attempt with non-existent email", {
				email: validatedData.email,
			})
			throw new AppError("Invalid email or password", 401)
		}

		// Check password
		const isPasswordValid = await user.comparePassword(validatedData.password)

		if (!isPasswordValid) {
			logger.warn("Login attempt with invalid password", {
				email: validatedData.email,
				userId: user._id.toString(),
			})
			throw new AppError("Invalid email or password", 401)
		}

		// Generate auth tokens
		const tokens = await AuthService.generateAuthTokens(user)

		if (req.session) {
			req.session.refreshToken = tokens.refreshToken
			req.session.userId = user._id.toString()
		}

		res.cookie("refreshToken", tokens.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
			path: "/",
		})

		res.cookie("accessToken", tokens.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 15 * 60,
			path: "/",
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
			req.session.destroy((err) => {
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
			req.session.destroy((err) => {
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
		let cookieToken: string | undefined
		let bodyToken: string | undefined
		let sessionToken: string | undefined

		if (req.cookies) {
			cookieToken = req.cookies.refreshToken as string | undefined
		}

		if (
			req.body &&
			typeof req.body === "object" &&
			"refreshToken" in req.body
		) {
			try {
				const validatedBody = refreshTokenSchema.parse(req.body)
				bodyToken = validatedBody.refreshToken
			} catch {
				bodyToken = undefined
			}
		}

		if (req.session) {
			sessionToken = req.session.refreshToken
		}

		const refreshToken = cookieToken || bodyToken || sessionToken

		if (!refreshToken) {
			throw new AppError("Refresh token is required", 400)
		}

		const accessToken = await AuthService.refreshAccessToken(refreshToken)

		res.cookie("accessToken", accessToken, {
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 15 * 60,
			path: "/",
		})

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
