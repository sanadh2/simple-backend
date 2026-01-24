import { Router } from "express"

import {
	AnalyticsController,
	DashboardAnalyticsController,
} from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

// Apply rate limiting to all analytics routes
router.use(apiLimiter)

// User-scoped job application analytics (requires userId from authenticate)
router.get(
	"/dashboard",
	authenticate,
	requireEmailVerified,
	DashboardAnalyticsController.getDashboard
)

router.get(
	"/statistics",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getStatistics
)

router.get(
	"/registration-trends",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getRegistrationTrends
)

router.get(
	"/active-sessions",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getActiveSessionsAnalysis
)

router.get(
	"/search",
	authenticate,
	requireEmailVerified,
	AnalyticsController.searchUsers
)

router.get(
	"/users",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getUsersPaginated
)

router.get(
	"/inactive-users",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getInactiveUsers
)

router.get(
	"/email-domains",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getEmailDomainStats
)

router.get(
	"/cohort-analysis",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getCohortAnalysis
)

router.get(
	"/power-users",
	authenticate,
	requireEmailVerified,
	AnalyticsController.getPowerUsers
)

export default router
