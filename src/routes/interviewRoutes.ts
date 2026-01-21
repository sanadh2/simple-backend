import { Router } from "express"

import { InterviewController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)

router.post("/", authenticate, requireEmailVerified, InterviewController.create)

router.get("/", authenticate, requireEmailVerified, InterviewController.getAll)

router.get(
	"/upcoming",
	authenticate,
	requireEmailVerified,
	InterviewController.getUpcoming
)

router.get(
	"/job-application/:jobApplicationId",
	authenticate,
	requireEmailVerified,
	InterviewController.getByJobApplicationId
)

router.get(
	"/:id",
	authenticate,
	requireEmailVerified,
	InterviewController.getById
)

router.put(
	"/:id",
	authenticate,
	requireEmailVerified,
	InterviewController.update
)

router.delete(
	"/:id",
	authenticate,
	requireEmailVerified,
	InterviewController.delete
)

export default router
