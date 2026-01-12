import { Router } from "express"

import { LogController } from "../controllers/logController.js"
import { authenticate } from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

// Apply rate limiting to all log routes
router.use(apiLimiter)

router.get("/", authenticate, LogController.getLogs)

router.get(
	"/correlation/:correlationId",
	authenticate,
	LogController.getLogsByCorrelationId
)

router.get("/statistics", authenticate, LogController.getLogStatistics)

router.get("/errors", authenticate, LogController.getRecentErrors)

router.get("/trends", authenticate, LogController.getLogTrends)

router.delete("/clear", authenticate, LogController.clearOldLogs)

export default router
