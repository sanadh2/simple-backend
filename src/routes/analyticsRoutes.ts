import { Router } from "express"

import { AnalyticsController } from "../controllers/analyticsController.js"
import { authenticate } from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

// Apply rate limiting to all analytics routes
router.use(apiLimiter)

router.get("/statistics", authenticate, AnalyticsController.getStatistics)

router.get(
	"/registration-trends",
	authenticate,
	AnalyticsController.getRegistrationTrends
)

router.get(
	"/active-sessions",
	authenticate,
	AnalyticsController.getActiveSessionsAnalysis
)

router.get("/search", authenticate, AnalyticsController.searchUsers)

router.get("/users", authenticate, AnalyticsController.getUsersPaginated)

router.get(
	"/inactive-users",
	authenticate,
	AnalyticsController.getInactiveUsers
)

router.get(
	"/email-domains",
	authenticate,
	AnalyticsController.getEmailDomainStats
)

router.get(
	"/cohort-analysis",
	authenticate,
	AnalyticsController.getCohortAnalysis
)

router.get("/power-users", authenticate, AnalyticsController.getPowerUsers)

export default router
