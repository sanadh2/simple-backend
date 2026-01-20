import { z } from "zod"

const envSchema = z.object({
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
	SMTP_USER: z.email("SMTP_USER must be a valid email"),
	SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
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

	CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
	CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
	CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
})

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
