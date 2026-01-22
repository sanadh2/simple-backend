import { Router } from "express"

import { ResumeController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"
import { uploadDocument } from "../middleware/uploadMiddleware.js"

const router = Router()

router.use(apiLimiter)

router.post(
	"/",
	authenticate,
	requireEmailVerified,
	uploadDocument.single("file"),
	ResumeController.create
)

router.get("/", authenticate, requireEmailVerified, ResumeController.getAll)

router.get("/:id", authenticate, requireEmailVerified, ResumeController.getById)

router.put("/:id", authenticate, requireEmailVerified, ResumeController.update)

router.delete(
	"/:id",
	authenticate,
	requireEmailVerified,
	ResumeController.delete
)

router.get(
	"/:id/applications",
	authenticate,
	requireEmailVerified,
	ResumeController.getApplications
)

router.get(
	"/:id/download",
	authenticate,
	requireEmailVerified,
	ResumeController.download
)

export default router
