import "dotenv/config"

import MongoStore from "connect-mongo"
import cookieParser from "cookie-parser"
import cors from "cors"
import express, { type Request, type Response } from "express"
import session from "express-session"
import swaggerUi from "swagger-ui-express"

import { connectDatabase } from "./config/database.js"
import { env } from "./config/env.js"
import { redisConnection } from "./config/redis.js"
import { swaggerSpec } from "./config/swagger.js"
import { correlationIdMiddleware } from "./middleware/correlationId.js"
import {
	AppError,
	asyncHandler,
	errorHandler,
	notFoundHandler,
} from "./middleware/errorHandler.js"
import { globalLimiter } from "./middleware/rateLimiter.js"
import { requestLoggerMiddleware } from "./middleware/requestLogger.js"
import { bookmarkQueue } from "./queues/bookmarkQueue.js"
import { logQueue } from "./queues/logQueue.js"
import analyticsRoutes from "./routes/analyticsRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import bookmarkRoutes from "./routes/bookmarkRoutes.js"
import logRoutes from "./routes/logRoutes.js"
import { logger } from "./utils/logger.js"
import { ResponseHandler } from "./utils/responseHandler.js"
import {
	startBookmarkWorker,
	stopBookmarkWorker,
} from "./workers/bookmarkWorker.js"
import { startLogWorker, stopLogWorker } from "./workers/logWorker.js"

const app = express()
const port = env.PORT

await connectDatabase()

startLogWorker()
startBookmarkWorker()

// Correlation ID middleware (must be first)
app.use(correlationIdMiddleware)

// Request logging middleware
app.use(requestLoggerMiddleware)

// CORS configuration
app.use(
	cors({
		origin:
			env.NODE_ENV === "production"
				? ["https://yourdomain.com"] // Update with your production domain
				: ["http://localhost:3000", "http://localhost:3001"], // Allow local development
  credentials: true, // Allow cookies and sessions
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
	})
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(globalLimiter)

// Swagger API documentation
app.use(
	"/api-docs",
	swaggerUi.serve,
	swaggerUi.setup(swaggerSpec, {
		customCss: ".swagger-ui .topbar { display: none }",
		customSiteTitle: "Authentication API Documentation",
	})
)

// Session configuration
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
			collectionName: "sessions",
      ttl: env.SESSION_MAX_AGE / 1000, // Convert to seconds
    }),
    cookie: {
      maxAge: env.SESSION_MAX_AGE,
      httpOnly: true,
			secure: env.NODE_ENV === "production", // Use secure cookies in production
			sameSite: "strict",
    },
		name: "sessionId", // Custom session cookie name
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

// Authentication routes
app.use("/api/auth", authRoutes)

// Analytics routes
app.use("/api/analytics", analyticsRoutes)

// Log routes
app.use("/api/logs", logRoutes)

app.use("/api/bookmarks", bookmarkRoutes)

app.use(notFoundHandler)

app.use(errorHandler)

const server = app.listen(port, () => {
	logger.info(`✓ Server running at http://localhost:${port}`, undefined, true)
	logger.info(
		`✓ API Documentation available at http://localhost:${port}/api-docs`,
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
			bookmarkQueue.close().then(() => console.log("✓ Bookmark queue closed")),
      stopLogWorker(),
			stopBookmarkWorker(),
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
