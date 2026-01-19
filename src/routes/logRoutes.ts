import { Router } from "express"

import { LogController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

// Apply rate limiting to all log routes
router.use(apiLimiter)

router.get("/", authenticate, requireEmailVerified, LogController.getLogs)

router.get(
	"/correlation/:correlationId",
	authenticate,
	requireEmailVerified,
	LogController.getLogsByCorrelationId
)

router.get(
	"/statistics",
	authenticate,
	requireEmailVerified,
	LogController.getLogStatistics
)

router.get(
	"/errors",
	authenticate,
	requireEmailVerified,
	LogController.getRecentErrors
)

router.get(
	"/trends",
	authenticate,
	requireEmailVerified,
	LogController.getLogTrends
)

router.delete(
	"/clear",
	authenticate,
	requireEmailVerified,
	LogController.clearOldLogs
)

export default router
