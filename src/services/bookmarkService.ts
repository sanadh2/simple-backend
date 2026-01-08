import mongoose from 'mongoose';
import { Bookmark, type IBookmark } from '../models/Bookmark.js';
import { AppError } from '../middleware/errorHandler.js';
import { bookmarkQueue, type BookmarkTagJob } from '../queues/bookmarkQueue.js';

export interface CreateBookmarkDTO {
  url: string;
  title: string;
  description?: string | undefined;
  tags?: string[] | undefined;
  useAI?: boolean | undefined;
}

export interface UpdateBookmarkDTO {
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
}

export class BookmarkService {
  static async createBookmark(userId: string, data: CreateBookmarkDTO): Promise<IBookmark> {
    const existingBookmark = await Bookmark.findOne({ userId, url: data.url });
    
    if (existingBookmark) {
      throw new AppError('Bookmark with this URL already exists', 409);
    }

    const tags = data.tags || [];
    const aiGenerated = false;
    const description = data.description;

    const bookmarkData = {
      userId: new mongoose.Types.ObjectId(userId),
      url: data.url,
      title: data.title,
      tags,
      aiGenerated,
      ...(description && { description }),
    };
    
    const bookmark = await Bookmark.create(bookmarkData);

    if (data.useAI !== false) {
      const jobData: BookmarkTagJob = {
        bookmarkId: bookmark._id.toString(),
        userId,
        url: data.url,
        title: data.title,
        ...(data.description && { description: data.description }),
      };
      
      await bookmarkQueue.add(
        'generate-tags',
        jobData,
        {
          jobId: `bookmark-${bookmark._id.toString()}`,
        }
      );
    }

    return bookmark;
  }

  static async getBookmarks(userId: string, filters: { tag?: string; search?: string; limit?: number; skip?: number }) {
    const query: Record<string, unknown> = { userId };

    if (filters.tag) {
      query.tags = filters.tag;
    }

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { url: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const limit = filters.limit || 50;
    const skip = filters.skip || 0;

    const [bookmarks, totalCount] = await Promise.all([
      Bookmark.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Bookmark.countDocuments(query),
    ]);

    return {
      bookmarks,
      totalCount,
      hasMore: skip + bookmarks.length < totalCount,
    };
  }

  static async getBookmarkById(userId: string, bookmarkId: string): Promise<IBookmark> {
    const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId });
    
    if (!bookmark) {
      throw new AppError('Bookmark not found', 404);
    }

    return bookmark;
  }

  static async updateBookmark(userId: string, bookmarkId: string, data: UpdateBookmarkDTO): Promise<IBookmark> {
    const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId });
    
    if (!bookmark) {
      throw new AppError('Bookmark not found', 404);
    }

    if (data.title) bookmark.title = data.title;
    if (data.description !== undefined) bookmark.description = data.description;
    if (data.tags) bookmark.tags = data.tags;

    await bookmark.save();

    return bookmark;
  }

  static async deleteBookmark(userId: string, bookmarkId: string): Promise<void> {
    const result = await Bookmark.deleteOne({ _id: bookmarkId, userId });
    
    if (result.deletedCount === 0) {
      throw new AppError('Bookmark not found', 404);
    }
  }

  static async getAllTags(userId: string): Promise<string[]> {
    const result = await Bookmark.aggregate<{ tag: string; count: number }>([
      { $match: { userId } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, tag: '$_id', count: 1 } },
    ]);

    return result.map((r) => r.tag);
  }

  static async regenerateTags(userId: string, bookmarkId: string): Promise<{ jobId: string; bookmark: IBookmark }> {
    const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId });
    
    if (!bookmark) {
      throw new AppError('Bookmark not found', 404);
    }

    const jobData: BookmarkTagJob = {
      bookmarkId: bookmark._id.toString(),
      userId,
      url: bookmark.url,
      title: bookmark.title,
      ...(bookmark.description && { description: bookmark.description }),
    };
    
    const job = await bookmarkQueue.add(
      'regenerate-tags',
      jobData,
      {
        jobId: `regenerate-${bookmark._id.toString()}-${Date.now()}`,
      }
    );

    return {
      jobId: job.id!,
      bookmark,
    };
  }
}