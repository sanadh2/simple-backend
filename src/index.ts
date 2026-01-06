import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { errorHandler, notFoundHandler, AppError, asyncHandler } from './middleware/errorHandler.js';
import { ResponseHandler } from './utils/responseHandler.js';
import { logger } from './utils/logger.js';

const app = express();
const port = env.PORT;

await connectDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  ResponseHandler.success(res, 200, {
    message: 'Hello from TypeScript Express!',
    data: { 
      version: '1.0.0',
      environment: env.NODE_ENV
    }
  });
});

app.get('/api/test', asyncHandler((_req: Request, res: Response) => {
  const data = { test: 'This is a test endpoint' };
  
  ResponseHandler.success(res, 200, {
    message: 'Test endpoint',
    data
  });
}));

app.get('/api/error', asyncHandler((_req: Request, _res: Response) => {
  throw new AppError('This is a test error', 400);
}));

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`✓ Server running at http://localhost:${port}`);
});