import { Router } from "express"

import { ContactController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)

router.post("/", authenticate, requireEmailVerified, ContactController.create)

router.get(
	"/job-application/:jobApplicationId",
	authenticate,
	requireEmailVerified,
	ContactController.getByJobApplicationId
)

router.get(
	"/:id",
	authenticate,
	requireEmailVerified,
	ContactController.getById
)

router.put("/:id", authenticate, requireEmailVerified, ContactController.update)

router.delete(
	"/:id",
	authenticate,
	requireEmailVerified,
	ContactController.delete
)

router.post(
	"/:id/interactions",
	authenticate,
	requireEmailVerified,
	ContactController.addInteraction
)

export default router
