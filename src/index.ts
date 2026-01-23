import "dotenv/config"

import MongoStore from "connect-mongo"
import cookieParser from "cookie-parser"
import cors from "cors"
import express, { type Request, type Response } from "express"
import session from "express-session"
import mongoose from "mongoose"
import swaggerUi from "swagger-ui-express"

import { connectDatabase } from "./config/database.js"
import { env } from "./config/env.js"
import { redisConnection } from "./config/redis.js"
import { swaggerSpec } from "./config/swagger.js"
import { correlation_idMiddleware } from "./middleware/correlationId.js"
import { deviceFingerprintMiddleware } from "./middleware/deviceFingerprint.js"
import {
	AppError,
	asyncHandler,
	errorHandler,
	notFoundHandler,
} from "./middleware/errorHandler.js"
import { globalLimiter } from "./middleware/rateLimiter.js"
import { requestLoggerMiddleware } from "./middleware/requestLogger.js"
import { logQueue } from "./queues/logQueue.js"
import {
	analyticsRoutes,
	authRoutes,
	companyRoutes,
	interviewRoutes,
	jobApplicationRoutes,
	logRoutes,
	resumeRoutes,
} from "./routes/index.js"
import { EmailService } from "./services/index.js"
import { logger } from "./utils/logger.js"
import { ResponseHandler } from "./utils/responseHandler.js"
import { startLogWorker, stopLogWorker } from "./workers/logWorker.js"

const app = express()
const port = env.PORT

app.set("trust proxy", 1)

await connectDatabase()

EmailService.initialize()
startLogWorker()

app.use(correlation_idMiddleware)
app.use(requestLoggerMiddleware)
// Device fingerprinting middleware - extracts device info and creates unique fingerprint
// Must be applied early so fingerprint is available for all routes
app.use(deviceFingerprintMiddleware)

app.use(
	cors({
		origin: env.FRONTEND_URL.split(",").map((url) => url.trim()),
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Correlation-ID",
			"X-Device-Fingerprint",
		],
	})
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

/**
 * Formats uptime in seconds to a human-readable string with years, months, days, hours, minutes, and seconds
 */
function formatUptime(seconds: number): string {
	const SECONDS_PER_MINUTE = 60
	const SECONDS_PER_HOUR = 3600
	const SECONDS_PER_DAY = 86400
	const SECONDS_PER_MONTH = 2629746
	const SECONDS_PER_YEAR = 31556952

	const parts: string[] = []
	let remaining = seconds

	if (remaining >= SECONDS_PER_YEAR) {
		const years = Math.floor(remaining / SECONDS_PER_YEAR)
		parts.push(`${years} ${years === 1 ? "year" : "years"}`)
		remaining %= SECONDS_PER_YEAR
	}

	if (remaining >= SECONDS_PER_MONTH) {
		const months = Math.floor(remaining / SECONDS_PER_MONTH)
		parts.push(`${months} ${months === 1 ? "month" : "months"}`)
		remaining %= SECONDS_PER_MONTH
	}

	if (remaining >= SECONDS_PER_DAY) {
		const days = Math.floor(remaining / SECONDS_PER_DAY)
		parts.push(`${days} ${days === 1 ? "day" : "days"}`)
		remaining %= SECONDS_PER_DAY
	}

	if (remaining >= SECONDS_PER_HOUR) {
		const hours = Math.floor(remaining / SECONDS_PER_HOUR)
		parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`)
		remaining %= SECONDS_PER_HOUR
	}

	if (remaining >= SECONDS_PER_MINUTE) {
		const minutes = Math.floor(remaining / SECONDS_PER_MINUTE)
		parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`)
		remaining %= SECONDS_PER_MINUTE
	}

	if (remaining > 0) {
		const secs = Math.floor(remaining)
		parts.push(`${secs} ${secs === 1 ? "second" : "seconds"}`)
	}

	if (parts.length === 0) {
		return "0 seconds"
	}

	return parts.join(", ")
}

app.get(
	"/health",
	asyncHandler(async (_req: Request, res: Response) => {
		const checks = {
			server: {
				status: "healthy",
				timestamp: new Date().toISOString(),
			},
			database: {
				status: "unknown" as "healthy" | "unhealthy" | "unknown",
				message: "",
			},
			redis: {
				status: "unknown" as "healthy" | "unhealthy" | "unknown",
				message: "",
			},
		}

		try {
			if (
				mongoose.connection.readyState ===
					mongoose.ConnectionStates.connected &&
				mongoose.connection.db
			) {
				await mongoose.connection.db.admin().ping()
				checks.database.status = "healthy"
				checks.database.message = "Connected"
			} else {
				checks.database.status = "unhealthy"
				checks.database.message = `Connection state: ${mongoose.connection.readyState}`
			}
		} catch (error) {
			checks.database.status = "unhealthy"
			checks.database.message = `Error: ${String(error)}`
		}

		try {
			const result = await redisConnection.ping()
			if (result === "PONG") {
				checks.redis.status = "healthy"
				checks.redis.message = "Connected"
			} else {
				checks.redis.status = "unhealthy"
				checks.redis.message = "Unexpected response"
			}
		} catch (error) {
			checks.redis.status = "unhealthy"
			checks.redis.message = `Error: ${String(error)}`
		}

		const allHealthy =
			checks.server.status === "healthy" &&
			checks.database.status === "healthy" &&
			checks.redis.status === "healthy"

		const statusCode = allHealthy ? 200 : 503

		ResponseHandler.success(res, statusCode, {
			message: allHealthy
				? "All systems operational"
				: "Some systems are unhealthy",
			data: {
				status: allHealthy ? "healthy" : "degraded",
				checks,
				uptime: formatUptime(process.uptime()),
				environment: env.NODE_ENV,
			},
		})
	})
)

app.use(globalLimiter)

app.use(
	"/api-docs",
	swaggerUi.serve,
	swaggerUi.setup(swaggerSpec, {
		customCss: ".swagger-ui .topbar { display: none }",
		customSiteTitle: "Authentication API Documentation",
	})
)

app.use(
	session({
		secret: env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({
			mongoUrl: env.MONGO_URI,
			collectionName: "sessions",
			ttl: env.SESSION_MAX_AGE / 1000,
		}),
		cookie: {
			maxAge: env.SESSION_MAX_AGE,
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: env.NODE_ENV === "production" ? "none" : "lax",
			path: "/",
		},
		name: "sessionId",
	})
)

app.get("/", (req: Request, res: Response) => {
	ResponseHandler.success(res, 200, {
		message: "Hello from TypeScript Express!",
		data: {
			version: "1.0.0",
			environment: env.NODE_ENV,
			documentation: `http://localhost:${port}/api-docs`,
		},
	})
})

app.get(
	"/api/test",
	asyncHandler((_req: Request, res: Response) => {
		const data = { test: "This is a test endpoint" }

		ResponseHandler.success(res, 200, {
			message: "Test endpoint",
			data,
		})
	})
)

app.get(
	"/api/error",
	asyncHandler((_req: Request, _res: Response) => {
		throw new AppError("This is a test error", 400)
	})
)

app.use("/api/auth", authRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/companies", companyRoutes)
app.use("/api/interviews", interviewRoutes)
app.use("/api/job-applications", jobApplicationRoutes)
app.use("/api/logs", logRoutes)
app.use("/api/resumes", resumeRoutes)

app.use(notFoundHandler)

app.use(errorHandler)

const server = app.listen(port, () => {
	logger.info(`✓ Server running at ${env.DOMAIN}:${port}`, undefined, true)
	logger.info(
		`✓ API Documentation available at http://${env.DOMAIN}:${port}/api-docs`,
		undefined,
		true
	)
})

const gracefulShutdown = () => {
	console.log("\n Graceful shutdown initiated...")

	server.close(() => {
		console.log("✓ HTTP server closed")

		Promise.all([
			logQueue.close().then(() => console.log("✓ Log queue closed")),
			stopLogWorker(),
			redisConnection
				.quit()
				.then(() => console.log("✓ Redis connection closed")),
		])
			.then(() => {
				process.exit(0)
			})
			.catch((error) => {
				console.error("Error during shutdown:", error)
				process.exit(1)
			})
	})

	setTimeout(() => {
		console.error("⚠️  Forceful shutdown after timeout")
		process.exit(1)
	}, 10000)
}

process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)
