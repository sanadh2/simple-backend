import { Router } from "express"

import { BookmarkController } from "../controllers/bookmarkController.js"
import { authenticate } from "../middleware/authMiddleware.js"
import { apiLimiter } from "../middleware/rateLimiter.js"

const router = Router()

router.use(apiLimiter)
router.use(authenticate)

router.post("/", BookmarkController.createBookmark)
router.get("/", BookmarkController.getBookmarks)
router.get("/tags", BookmarkController.getAllTags)
router.get("/:id", BookmarkController.getBookmarkById)
router.put("/:id", BookmarkController.updateBookmark)
router.delete("/:id", BookmarkController.deleteBookmark)

export default router
