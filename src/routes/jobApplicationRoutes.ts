import { Router } from "express"

import { JobApplicationController } from "../controllers/index.js"
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
	JobApplicationController.create
)

router.post(
	"/quick",
	authenticate,
	requireEmailVerified,
	JobApplicationController.quick
)

router.get(
	"/",
	authenticate,
	requireEmailVerified,
	JobApplicationController.getAll
)

router.get(
	"/:id",
	authenticate,
	requireEmailVerified,
	JobApplicationController.getById
)

router.put(
	"/:id",
	authenticate,
	requireEmailVerified,
	JobApplicationController.update
)

router.delete(
	"/:id",
	authenticate,
	requireEmailVerified,
	JobApplicationController.delete
)

router.post(
	"/upload-file",
	authenticate,
	requireEmailVerified,
	uploadDocument.single("file"),
	JobApplicationController.uploadFile
)

export default router
