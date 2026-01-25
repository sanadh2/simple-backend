import { z } from "zod"

const envSchema = z
	.object({
		DOMAIN: z.string().default("localhost"),
		PORT: z
			.string()
			.default("3000")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().positive()),

		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),

		MONGO_URI: z.url().min(1, "MONGO_URI is required"),

		JWT_ACCESS_SECRET: z
			.string()
			.min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
		JWT_REFRESH_SECRET: z
			.string()
			.min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
		JWT_ACCESS_EXPIRY: z.string().default("15m"),
		JWT_REFRESH_EXPIRY: z.string().default("7d"),
		JWT_EXTENSION_EXPIRY: z.string().default("90d"),

		SESSION_SECRET: z
			.string()
			.min(32, "SESSION_SECRET must be at least 32 characters"),
		SESSION_MAX_AGE: z
			.string()
			.default("86400000")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().positive()),

		REDIS_HOST: z.string().default("localhost"),
		REDIS_PORT: z
			.string()
			.default("6379")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().positive()),
		REDIS_PASSWORD: z.string().optional(),
		FRONTEND_URL: z.string().default("http://localhost:4001"),

		SMTP_HOST: z.string().default("smtp.gmail.com"),
		SMTP_PORT: z
			.string()
			.default("587")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().positive()),
		SMTP_SECURE: z
			.string()
			.default("false")
			.transform((val) => val === "true"),
		SMTP_USER: z.email("SMTP_USER must be a valid email").optional(),
		SMTP_PASS: z.string().optional(),
		EMAIL_FROM: z.email("EMAIL_FROM must be a valid email"),
		EMAIL_FROM_NAME: z.string().default("Job Application Tracker"),

		OTP_EXPIRY_MINUTES: z
			.string()
			.default("10")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().positive()),
		OTP_LENGTH: z
			.string()
			.default("6")
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().min(4).max(8)),

		CLOUDINARY_CLOUD_NAME: z
			.string()
			.min(1, "CLOUDINARY_CLOUD_NAME is required"),
		CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
		CLOUDINARY_API_SECRET: z
			.string()
			.min(1, "CLOUDINARY_API_SECRET is required"),
		BREVO_API_KEY: z.string().min(1).optional(),
	})
	.refine(
		(data) =>
			data.NODE_ENV !== "production" ||
			(typeof data.BREVO_API_KEY === "string" && data.BREVO_API_KEY.length > 0),
		{
			message: "BREVO_API_KEY is required in production",
			path: ["BREVO_API_KEY"],
		}
	)
	.refine(
		(data) =>
			(data.NODE_ENV !== "development" && data.NODE_ENV !== "test") ||
			(typeof data.SMTP_USER === "string" &&
				data.SMTP_USER.length > 0 &&
				typeof data.SMTP_PASS === "string" &&
				data.SMTP_PASS.length > 0),
		{
			message: "SMTP_USER and SMTP_PASS are required in development and test",
			path: ["SMTP_USER"],
		}
	)

export type Env = z.infer<typeof envSchema>

/**
 * Validates environment variables against the schema
 * @throws {Error} If validation fails
 * @returns {Env} Validated environment variables
 */
export const validateEnv = (): Env => {
	try {
		const validated = envSchema.parse(process.env)
		return validated
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessages = error.issues
				.map((err) => `  - ${err.path.join(".")}: ${err.message}`)
				.join("\n")

			console.error(
				"❌ Environment variable validation failed:\n" + errorMessages
			)
			process.exit(1)
		}

		throw error
	}
}

export const env = validateEnv()
