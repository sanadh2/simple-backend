import { Router } from "express"

import { ScheduledEmailController } from "../controllers/scheduledEmailController.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)

router.get(
	"/upcoming",
	authenticate,
	requireEmailVerified,
	ScheduledEmailController.getUpcoming
)

export default router
