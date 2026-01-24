import { Router } from "express"

import { ActivityController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)

router.get(
	"/timeline",
	authenticate,
	requireEmailVerified,
	ActivityController.getTimeline
)

export default router
