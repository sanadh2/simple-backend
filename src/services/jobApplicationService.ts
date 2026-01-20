import mongoose from "mongoose"
import { z } from "zod"

import { JobApplication, StatusHistory } from "../models/index.js"

export const createJobApplicationSchema = z.object({
	company_name: z.string().min(1, "Company name is required"),
	job_title: z.string().min(1, "Job title is required"),
	job_description: z.string().optional(),
	notes: z.string().optional(),
	application_date: z.coerce.date(),
	status: z.enum([
		"Wishlist",
		"Applied",
		"Interview Scheduled",
		"Interviewing",
		"Offer",
		"Rejected",
		"Accepted",
		"Withdrawn",
	]),
	salary_range: z.string().optional(),
	location_type: z.enum(["remote", "hybrid", "onsite"]),
	location_city: z.string().optional(),
	job_posting_url: z.url("Invalid URL format").optional().or(z.literal("")),
	application_method: z.string().optional(),
	priority: z.enum(["high", "medium", "low"]),
	resume_url: z.url("Invalid URL format").optional().or(z.literal("")),
	cover_letter_url: z.url("Invalid URL format").optional().or(z.literal("")),
})

export const updateJobApplicationSchema = createJobApplicationSchema.partial()

export type CreateJobApplicationInput = z.infer<
	typeof createJobApplicationSchema
>
export type UpdateJobApplicationInput = z.infer<
	typeof updateJobApplicationSchema
>

export interface IStatusHistory {
	status: string
	changed_at: Date
}

export interface IJobApplicationWithHistory {
	_id: mongoose.Types.ObjectId
	user_id: mongoose.Types.ObjectId
	company_name: string
	job_title: string
	job_description?: string
	notes?: string
	application_date: Date
	status: string
	salary_range?: string
	location_type: string
	location_city?: string
	job_posting_url?: string
	application_method?: string
	priority: string
	status_history: IStatusHistory[]
	createdAt: Date
	updatedAt: Date
}

interface PaginatedJobApplications {
	applications: IJobApplicationWithHistory[]
	totalCount: number
	currentPage: number
	pageSize: number
	totalPages: number
}

interface JobApplicationFilters {
	status?: string
	priority?: string
	company_name?: string
	startDate?: Date
	endDate?: Date
}

export class JobApplicationService {
	static async create(
		userId: string,
		data: CreateJobApplicationInput
	): Promise<IJobApplicationWithHistory> {
		const jobApplicationData: Record<string, unknown> = {
			user_id: userId,
			company_name: data.company_name,
			job_title: data.job_title,
			application_date: data.application_date,
			status: data.status,
			location_type: data.location_type,
			priority: data.priority,
		}

		if (data.job_description) {
			jobApplicationData.job_description = data.job_description
		}
		if (data.notes) {
			jobApplicationData.notes = data.notes
		}
		if (data.salary_range) {
			jobApplicationData.salary_range = data.salary_range
		}
		if (data.location_city) {
			jobApplicationData.location_city = data.location_city
		}
		if (data.job_posting_url) {
			jobApplicationData.job_posting_url = data.job_posting_url
		}
		if (data.application_method) {
			jobApplicationData.application_method = data.application_method
		}
		if (data.resume_url) {
			jobApplicationData.resume_url = data.resume_url
		}
		if (data.cover_letter_url) {
			jobApplicationData.cover_letter_url = data.cover_letter_url
		}

		const jobApplication = await JobApplication.create(jobApplicationData)

		await StatusHistory.create({
			job_application_id: jobApplication._id,
			status: data.status,
			changed_at: new Date(),
		})

		const statusHistory = await StatusHistory.find({
			job_application_id: jobApplication._id,
		})
			.sort({ changed_at: -1 })
			.lean()

		return {
			...jobApplication.toObject(),
			status_history: statusHistory.map((entry) => ({
				status: entry.status,
				changed_at: entry.changed_at,
			})),
		} as IJobApplicationWithHistory
	}

	static async getById(
		jobApplicationId: string,
		userId: string
	): Promise<IJobApplicationWithHistory | null> {
		const jobApplication = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		}).lean()

		if (!jobApplication) {
			return null
		}

		const statusHistory = await StatusHistory.find({
			job_application_id: jobApplicationId,
		})
			.sort({ changed_at: -1 })
			.lean()

		return {
			...jobApplication,
			status_history: statusHistory.map((entry) => ({
				status: entry.status,
				changed_at: entry.changed_at,
			})),
		} as IJobApplicationWithHistory
	}

	static async getAll(
		userId: string,
		filters: JobApplicationFilters = {},
		page: number = 1,
		limit: number = 20
	): Promise<PaginatedJobApplications> {
		const skip = (page - 1) * limit

		const query: Record<string, unknown> = { user_id: userId }

		if (filters.status) {
			query.status = filters.status
		}

		if (filters.priority) {
			query.priority = filters.priority
		}

		if (filters.company_name) {
			query.company_name = { $regex: filters.company_name, $options: "i" }
		}

		if (filters.startDate || filters.endDate) {
			const dateFilter: Record<string, Date> = {}
			if (filters.startDate) {
				dateFilter.$gte = filters.startDate
			}
			if (filters.endDate) {
				dateFilter.$lte = filters.endDate
			}
			query.application_date = dateFilter
		}

		const [applications, totalCount] = await Promise.all([
			JobApplication.find(query)
				.sort({ application_date: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			JobApplication.countDocuments(query),
		])

		const applicationIds = applications.map((app) => app._id.toString())

		const statusHistoryMap = new Map<
			string,
			Array<{ status: string; changed_at: Date }>
		>()
		if (applicationIds.length > 0) {
			const allStatusHistory = await StatusHistory.find({
				job_application_id: { $in: applicationIds },
			})
				.sort({ changed_at: -1 })
				.lean()

			for (const entry of allStatusHistory) {
				const appId = entry.job_application_id.toString()
				if (!statusHistoryMap.has(appId)) {
					statusHistoryMap.set(appId, [])
				}
				statusHistoryMap.get(appId)?.push({
					status: entry.status,
					changed_at: entry.changed_at,
				})
			}
		}

		const applicationsWithHistory = applications.map((app) => ({
			...app,
			status_history: statusHistoryMap.get(app._id.toString()) || [],
		})) as IJobApplicationWithHistory[]

		const totalPages = Math.ceil(totalCount / limit)

		return {
			applications: applicationsWithHistory,
			totalCount,
			currentPage: page,
			pageSize: limit,
			totalPages,
		}
	}

	static async update(
		jobApplicationId: string,
		userId: string,
		data: UpdateJobApplicationInput
	): Promise<IJobApplicationWithHistory | null> {
		const existingApplication = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		}).lean()

		if (!existingApplication) {
			return null
		}

		const updateData: Record<string, unknown> = { ...data }

		const jobApplication = await JobApplication.findOneAndUpdate(
			{ _id: jobApplicationId, user_id: userId },
			{ $set: updateData },
			{ new: true, runValidators: true }
		).lean()

		if (!jobApplication) {
			return null
		}

		if (data.status && data.status !== existingApplication.status) {
			await StatusHistory.create({
				job_application_id: jobApplicationId,
				status: data.status,
				changed_at: new Date(),
			})
		}

		const statusHistory = await StatusHistory.find({
			job_application_id: jobApplicationId,
		})
			.sort({ changed_at: -1 })
			.lean()

		return {
			...jobApplication,
			status_history: statusHistory.map((entry) => ({
				status: entry.status,
				changed_at: entry.changed_at,
			})),
		} as IJobApplicationWithHistory
	}

	static async delete(
		jobApplicationId: string,
		userId: string
	): Promise<boolean> {
		const result = await JobApplication.deleteOne({
			_id: jobApplicationId,
			user_id: userId,
		})

		return result.deletedCount > 0
	}
}
