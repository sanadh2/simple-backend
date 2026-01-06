import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'access',
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as StringValue,
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  static generateRefreshToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'refresh',
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as StringValue,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static async generateAuthTokens(user: IUser): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(user._id.toString(), user.email);
    const refreshToken = this.generateRefreshToken(user._id.toString(), user.email);

    // Store refresh token in database
    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      
      if (decoded.type !== 'access') {
        throw new AppError('Invalid token type', 401);
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401);
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
      
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401);
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database
    const user = await User.findOne({
      _id: decoded.userId,
      refreshTokens: refreshToken,
    });

    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Generate new access token
    return this.generateAccessToken(user._id.toString(), user.email);
  }

  /**
   * Revoke a specific refresh token
   */
  static async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  static async revokeAllRefreshTokens(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { refreshTokens: [] },
    });
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7);
  }
}

