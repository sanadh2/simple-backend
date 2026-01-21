import { Router } from "express"

import { CompanyController } from "../controllers/index.js"
import {
	authenticate,
	requireEmailVerified,
} from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)

router.post("/", authenticate, requireEmailVerified, CompanyController.create)

router.get("/", authenticate, requireEmailVerified, CompanyController.getAll)

router.get(
	"/:id",
	authenticate,
	requireEmailVerified,
	CompanyController.getById
)

router.put("/:id", authenticate, requireEmailVerified, CompanyController.update)

router.delete(
	"/:id",
	authenticate,
	requireEmailVerified,
	CompanyController.delete
)

export default router
