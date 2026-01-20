import { z } from "zod"

import { type IJobApplication, JobApplication } from "../models/index.js"

export const createJobApplicationSchema = z.object({
	company_name: z.string().min(1, "Company name is required"),
	job_title: z.string().min(1, "Job title is required"),
	job_description: z.string().optional(),
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
})

export const updateJobApplicationSchema = createJobApplicationSchema.partial()

export type CreateJobApplicationInput = z.infer<
	typeof createJobApplicationSchema
>
export type UpdateJobApplicationInput = z.infer<
	typeof updateJobApplicationSchema
>

interface PaginatedJobApplications {
	applications: IJobApplication[]
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
	): Promise<IJobApplication> {
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

		const jobApplication = await JobApplication.create(jobApplicationData)

		return jobApplication
	}

	static async getById(
		jobApplicationId: string,
		userId: string
	): Promise<IJobApplication | null> {
		const jobApplication = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		})

		return jobApplication
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

		const totalPages = Math.ceil(totalCount / limit)

		return {
			applications: applications as IJobApplication[],
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
	): Promise<IJobApplication | null> {
		const jobApplication = await JobApplication.findOneAndUpdate(
			{ _id: jobApplicationId, user_id: userId },
			{ $set: data },
			{ new: true, runValidators: true }
		)

		return jobApplication
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
