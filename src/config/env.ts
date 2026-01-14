import { z } from "zod"

// Define the schema for environment variables
const envSchema = z.object({
	// Server Configuration
	PORT: z
		.string()
		.default("3000")
		.transform((val) => parseInt(val, 10))
		.pipe(z.number().positive()),

	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),

	// Database Configuration
	MONGO_URI: z.url().min(1, "MONGO_URI is required"),

	// Authentication Configuration
	JWT_ACCESS_SECRET: z
		.string()
		.min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
	JWT_REFRESH_SECRET: z
		.string()
		.min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
	JWT_ACCESS_EXPIRY: z.string().default("15m"),
	JWT_REFRESH_EXPIRY: z.string().default("7d"),

	// Session Configuration
	SESSION_SECRET: z
		.string()
		.min(32, "SESSION_SECRET must be at least 32 characters"),
	SESSION_MAX_AGE: z
		.string()
		.default("86400000")
		.transform((val) => parseInt(val, 10))
		.pipe(z.number().positive()),

	// Redis Configuration (optional, defaults for local development)
	REDIS_HOST: z.string().default("localhost"),
	REDIS_PORT: z
		.string()
		.default("6379")
		.transform((val) => parseInt(val, 10))
		.pipe(z.number().positive()),
	REDIS_PASSWORD: z.string().optional(),
	// Ollama Configuration (for GPT-OSS:20b)
	OLLAMA_API_URL: z.url().default("http://localhost:11434"),
	OLLAMA_MODEL: z.string().default("gpt-oss:20b"),
	FRONTEND_URL: z.url().default("http://localhost:4001"),
})

// Export the inferred type
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

// Validate and export the environment configuration
export const env = validateEnv()
