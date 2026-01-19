import type { CookieOptions, Request, Response } from "express"
import { z } from "zod"

import { env } from "../config/env.js"
import { AppError, asyncHandler } from "../middleware/errorHandler.js"
import { User } from "../models/index.js"
import { AuthService, EmailService, OTPService } from "../services/index.js"
import { Logger, logger } from "../utils/logger.js"
import { ResponseHandler } from "../utils/responseHandler.js"

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

const verifyEmailSchema = z.object({
	otp: z.string().min(4, "OTP is required"),
})

const requestPasswordResetSchema = z.object({
	email: z.email("Invalid email address"),
})

const resetPasswordSchema = z.object({
	email: z.email("Invalid email address"),
	otp: z.string().min(4, "OTP is required"),
	newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

const cookieOptions: CookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: env.NODE_ENV === "production" ? "none" : "lax",
	path: "/",
}

export class AuthController {
	static register = asyncHandler(async (req: Request, res: Response) => {
		logger.debug("Registration request received", {
			email: (req.body as { email?: string }).email,
			hasFirstName: !!(req.body as { firstName?: string }).firstName,
			hasLastName: !!(req.body as { lastName?: string }).lastName,
		})

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

		const tokens = await AuthService.generateAuthTokens(user)

		logger.debug("Auth tokens generated", {
			userId: user._id.toString(),
			hasAccessToken: !!tokens.accessToken,
			hasRefreshToken: !!tokens.refreshToken,
		})

		try {
			const otp = OTPService.generateOTP()
			const expiry = OTPService.getOTPExpiry()

			await User.findByIdAndUpdate(user._id, {
				emailVerificationOTP: otp,
				emailVerificationOTPExpiry: expiry,
			})

			await EmailService.sendVerificationOTP(user.email, user.firstName, otp)

			logger.info("Verification OTP sent to new user", {
				userId: user._id.toString(),
				email: user.email,
			})
		} catch (error) {
			logger.error("Failed to send verification OTP", {
				error: error instanceof Error ? error.message : "Unknown error",
				userId: user._id.toString(),
			})
		}

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

	static sendVerificationOTP = asyncHandler(
		async (req: Request, res: Response) => {
			if (!req.userId) {
				throw new AppError("Authentication required", 401)
			}

			const user = await User.findById(req.userId)
			if (!user) {
				throw new AppError("User not found", 404)
			}

			if (user.isEmailVerified) {
				throw new AppError("Email already verified", 400)
			}

			const otp = OTPService.generateOTP()
			const expiry = OTPService.getOTPExpiry()

			await User.findByIdAndUpdate(user._id, {
				emailVerificationOTP: otp,
				emailVerificationOTPExpiry: expiry,
			})

			await EmailService.sendVerificationOTP(user.email, user.firstName, otp)

			logger.info("Verification OTP sent", {
				userId: user._id.toString(),
				email: user.email,
			})

			ResponseHandler.success(res, 200, {
				message: "Verification OTP sent to your email",
			})
		}
	)

	static verifyEmail = asyncHandler(async (req: Request, res: Response) => {
		if (!req.userId) {
			throw new AppError("Authentication required", 401)
		}

		const validatedData = verifyEmailSchema.parse(req.body)

		const user = await User.findById(req.userId).select(
			"+emailVerificationOTP +emailVerificationOTPExpiry"
		)
		if (!user) {
			throw new AppError("User not found", 404)
		}

		if (user.isEmailVerified) {
			throw new AppError("Email already verified", 400)
		}

		const isValid = OTPService.verifyOTP(
			validatedData.otp,
			user.emailVerificationOTP,
			user.emailVerificationOTPExpiry
		)

		if (!isValid) {
			logger.warn("Invalid or expired verification OTP", {
				userId: user._id.toString(),
			})
			throw new AppError("Invalid or expired OTP", 400)
		}

		await User.findByIdAndUpdate(user._id, {
			isEmailVerified: true,
			$unset: {
				emailVerificationOTP: "",
				emailVerificationOTPExpiry: "",
			},
		})

		logger.info("Email verified successfully", {
			userId: user._id.toString(),
			email: user.email,
		})

		ResponseHandler.success(res, 200, {
			message: "Email verified successfully",
		})
	})

	static requestPasswordReset = asyncHandler(
		async (req: Request, res: Response) => {
			const validatedData = requestPasswordResetSchema.parse(req.body)

			const user = await User.findOne({ email: validatedData.email })
			if (!user) {
				logger.debug("Password reset requested for non-existent email", {
					email: validatedData.email,
				})
				ResponseHandler.success(res, 200, {
					message:
						"If an account exists with this email, a password reset OTP has been sent",
				})
				return
			}

			const otp = OTPService.generateOTP()
			const expiry = OTPService.getOTPExpiry()

			await User.findByIdAndUpdate(user._id, {
				passwordResetOTP: otp,
				passwordResetOTPExpiry: expiry,
			})

			await EmailService.sendPasswordResetOTP(user.email, user.firstName, otp)

			logger.info("Password reset OTP sent", {
				userId: user._id.toString(),
				email: user.email,
			})

			ResponseHandler.success(res, 200, {
				message:
					"If an account exists with this email, a password reset OTP has been sent",
			})
		}
	)

	static resetPassword = asyncHandler(async (req: Request, res: Response) => {
		const validatedData = resetPasswordSchema.parse(req.body)

		const user = await User.findOne({ email: validatedData.email }).select(
			"+password +passwordResetOTP +passwordResetOTPExpiry"
		)
		if (!user) {
			throw new AppError("User not found", 404)
		}

		// Verify OTP
		const isValid = OTPService.verifyOTP(
			validatedData.otp,
			user.passwordResetOTP,
			user.passwordResetOTPExpiry
		)

		if (!isValid) {
			logger.warn("Invalid or expired password reset OTP", {
				userId: user._id.toString(),
			})
			throw new AppError("Invalid or expired OTP", 400)
		}

		user.password = validatedData.newPassword
		await user.save()

		await User.findByIdAndUpdate(user._id, {
			$unset: {
				passwordResetOTP: "",
				passwordResetOTPExpiry: "",
			},
		})

		await AuthService.revokeAllRefreshTokens(user._id.toString())

		logger.info("Password reset successfully", {
			userId: user._id.toString(),
			email: user.email,
		})

		ResponseHandler.success(res, 200, {
			message: "Password reset successfully",
		})
	})
}
