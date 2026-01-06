import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { User, type IUser } from '../models/User.js';
import { AppError, asyncHandler } from './errorHandler.js';

// Extend Express Request type to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    userId?: string;
  }
}

/**
 * Middleware to verify JWT access token
 * Adds user object to request if token is valid
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // Extract token from Authorization header
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    // Verify token
    const decoded = AuthService.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError('User not found. Token may be invalid.', 401);
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id.toString();

    next();
  }
);

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't throw error if token is missing
 */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      try {
        const decoded = AuthService.verifyAccessToken(token);
        const user = await User.findById(decoded.userId);

        if (user) {
          req.user = user;
          req.userId = user._id.toString();
        }
      } catch {
        // Silently fail for optional authentication
      }
    }

    next();
  }
);

/**
 * Middleware to check if user email is verified
 */
export const requireEmailVerified = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (!req.user.isEmailVerified) {
    throw new AppError('Email verification required to access this resource', 403);
  }

  next();
};

