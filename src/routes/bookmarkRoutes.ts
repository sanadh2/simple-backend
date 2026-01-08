import { Router } from 'express';
import { BookmarkController } from '../controllers/bookmarkController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(apiLimiter);
router.use(authenticate);

router.post('/', BookmarkController.createBookmark);
router.get('/', BookmarkController.getBookmarks);
router.get('/tags', BookmarkController.getAllTags);
router.get('/jobs/stats', BookmarkController.getQueueStats);
router.get('/jobs/failed', BookmarkController.getFailedJobs);
router.get('/jobs/completed', BookmarkController.getCompletedJobs);
router.post('/jobs/:jobId/retry', BookmarkController.retryTagJob);
router.get('/jobs/:jobId', BookmarkController.getTagJobStatus);
router.get('/:id/jobs/active', BookmarkController.getActiveJobForBookmark);
router.get('/:id', BookmarkController.getBookmarkById);
router.put('/:id', BookmarkController.updateBookmark);
router.delete('/:id', BookmarkController.deleteBookmark);
router.post('/:id/regenerate-tags', BookmarkController.regenerateTags);

export default router;

