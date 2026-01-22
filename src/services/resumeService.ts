import mongoose from "mongoose"
import { z } from "zod"

import { JobApplication, Resume } from "../models/index.js"
import { logger } from "../utils/logger.js"
import { fileUploadService } from "./index.js"

export const createResumeSchema = z.object({
	description: z.string().optional(),
	file_name: z.string().optional(),
	file_size: z.number().optional(),
})

export const updateResumeSchema = z.object({
	description: z.string().optional(),
	version: z.number().min(1).optional(),
})

export type CreateResumeInput = z.infer<typeof createResumeSchema>
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>

export interface IResumeWithApplications {
	_id: mongoose.Types.ObjectId
	user_id: mongoose.Types.ObjectId
	version: number
	description?: string
	file_url: string
	file_name?: string
	file_size?: number
	application_count?: number
	createdAt: Date
	updatedAt: Date
}

export class ResumeService {
	/**
	 * Get the next version number for a user
	 */
	static async getNextVersion(userId: string): Promise<number> {
		const latestResume = await Resume.findOne({ user_id: userId })
			.sort({ version: -1 })
			.lean()

		if (!latestResume) {
			return 1
		}

		return latestResume.version + 1
	}

	/**
	 * Create a new resume version
	 */
	static async create(
		userId: string,
		fileBuffer: Buffer,
		filename: string,
		data: CreateResumeInput
	): Promise<IResumeWithApplications> {
		// Upload file to storage
		const uploadResult = await fileUploadService.uploadFile(
			fileBuffer,
			filename,
			"resumes",
			userId,
			"raw"
		)

		// Get next version number
		const version = await this.getNextVersion(userId)

		// Create resume record
		const resumeData: Record<string, unknown> = {
			user_id: userId,
			version,
			file_url: uploadResult.url,
		}

		if (data.description) {
			resumeData.description = data.description
		}
		if (data.file_name || filename) {
			resumeData.file_name = data.file_name || filename
		}
		if (data.file_size || fileBuffer.length) {
			resumeData.file_size = data.file_size || fileBuffer.length
		}

		const resume = await Resume.create(resumeData)

		logger.info("Resume created", {
			resumeId: resume._id.toString(),
			userId,
			version,
		})

		return {
			...resume.toObject(),
			application_count: 0,
		}
	}

	/**
	 * Get all resumes for a user
	 */
	static async getAll(userId: string): Promise<IResumeWithApplications[]> {
		const resumes = await Resume.find({ user_id: userId })
			.sort({ version: -1 })
			.lean()

		const resumeIds = resumes.map((r) => r._id)

		const applicationCounts: Array<{
			_id: mongoose.Types.ObjectId
			count: number
		}> = await JobApplication.aggregate([
			{
				$match: {
					user_id: new mongoose.Types.ObjectId(userId),
					resume_id: { $in: resumeIds },
				},
			},
			{
				$group: {
					_id: "$resume_id",
					count: { $sum: 1 },
				},
			},
		])

		const countMap = new Map(
			applicationCounts.map((item) => [item._id.toString(), item.count])
		)

		return resumes.map((resume) => ({
			...resume,
			application_count: countMap.get(resume._id.toString()) || 0,
		}))
	}

	/**
	 * Get a resume by ID
	 */
	static async getById(
		resumeId: string,
		userId: string
	): Promise<IResumeWithApplications | null> {
		const resume = await Resume.findOne({
			_id: resumeId,
			user_id: userId,
		}).lean()

		if (!resume) {
			return null
		}

		// Get application count
		const applicationCount = await JobApplication.countDocuments({
			user_id: userId,
			resume_id: resume._id,
		})

		return {
			...resume,
			application_count: applicationCount,
		}
	}

	/**
	 * Update a resume (description only, version is immutable)
	 */
	static async update(
		resumeId: string,
		userId: string,
		data: UpdateResumeInput
	): Promise<IResumeWithApplications | null> {
		const updateData: Record<string, unknown> = {}

		if (data.description !== undefined) {
			updateData.description = data.description
		}

		const resume = await Resume.findOneAndUpdate(
			{ _id: resumeId, user_id: userId },
			{ $set: updateData },
			{ new: true, runValidators: true }
		).lean()

		if (!resume) {
			return null
		}

		// Get application count
		const applicationCount = await JobApplication.countDocuments({
			user_id: userId,
			resume_id: resume._id,
		})

		logger.info("Resume updated", {
			resumeId,
			userId,
		})

		return {
			...resume,
			application_count: applicationCount,
		}
	}

	/**
	 * Delete a resume
	 */
	static async delete(resumeId: string, userId: string): Promise<boolean> {
		const resume = await Resume.findOne({
			_id: resumeId,
			user_id: userId,
		}).lean()

		if (!resume) {
			return false
		}

		// Delete file from storage
		try {
			await fileUploadService.deleteFile(resume.file_url, "raw")
		} catch (error) {
			logger.error(
				"Failed to delete resume file from storage",
				error instanceof Error ? error : new Error(String(error)),
				{ resumeId, fileUrl: resume.file_url }
			)
			// Continue with database deletion even if file deletion fails
		}

		// Delete resume record
		await Resume.deleteOne({ _id: resumeId, user_id: userId })

		logger.info("Resume deleted", {
			resumeId,
			userId,
		})

		return true
	}

	/**
	 * Get applications that use a specific resume
	 */
	static async getApplicationsUsingResume(
		resumeId: string,
		userId: string
	): Promise<Array<{ _id: string; company_name: string; job_title: string }>> {
		const applications = await JobApplication.find({
			user_id: userId,
			resume_id: resumeId,
		})
			.select("_id company_name job_title")
			.lean()

		return applications.map((app) => ({
			_id: app._id.toString(),
			company_name: app.company_name,
			job_title: app.job_title,
		}))
	}
}
