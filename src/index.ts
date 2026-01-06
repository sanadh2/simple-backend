import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { errorHandler, notFoundHandler, AppError, asyncHandler } from './middleware/errorHandler.js';
import { ResponseHandler } from './utils/responseHandler.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';

const app = express();
const port = env.PORT;

await connectDatabase();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      collectionName: 'sessions',
      ttl: env.SESSION_MAX_AGE / 1000, // Convert to seconds
    }),
    cookie: {
      maxAge: env.SESSION_MAX_AGE,
      httpOnly: true,
      secure: env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'strict',
    },
    name: 'sessionId', // Custom session cookie name
  })
);

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

// Authentication routes
app.use('/api/auth', authRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`✓ Server running at http://localhost:${port}`);
});