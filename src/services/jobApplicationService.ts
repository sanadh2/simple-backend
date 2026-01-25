import mongoose from "mongoose"
import { z } from "zod"

import { JobApplication, StatusHistory } from "../models/index.js"
import { logger } from "../utils/logger.js"
import { fileUploadService } from "./index.js"

export const createJobApplicationSchema = z.object({
	company_id: z.string().optional(),
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
	resume_id: z.string().optional(),
	resume_url: z.url("Invalid URL format").optional().or(z.literal("")),
	cover_letter_url: z.url("Invalid URL format").optional().or(z.literal("")),
})

export const updateJobApplicationSchema = createJobApplicationSchema.partial()

/** Schema for extension/bookmarklet quick-save: only company, title, description, url, method. */
export const quickCreateJobApplicationSchema = z.object({
	company_name: z.string().min(1, "Company name is required"),
	job_title: z.string().min(1, "Job title is required"),
	job_description: z.string().optional(),
	job_posting_url: z.url().optional().or(z.literal("")),
	application_method: z.string().optional(),
})

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
	search?: string
	sortBy?: string
	sortOrder?: "asc" | "desc"
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

		if (data.company_id) {
			jobApplicationData.company_id = data.company_id
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
		if (data.resume_id) {
			jobApplicationData.resume_id = data.resume_id
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

		// Treat "All" as no status filter
		if (filters.status && filters.status !== "All") {
			query.status = filters.status
		}

		if (filters.priority) {
			query.priority = filters.priority
		}

		if (filters.search) {
			// Search takes precedence - search both company name and job title
			query.$or = [
				{ company_name: { $regex: filters.search, $options: "i" } },
				{ job_title: { $regex: filters.search, $options: "i" } },
			]
		} else if (filters.company_name) {
			// Only use company_name filter if search is not provided
			query.company_name = { $regex: filters.company_name, $options: "i" }
		}

		// Date filter: use createdAt when status is All/empty; use status "at" date when a specific status is selected
		if (filters.startDate || filters.endDate) {
			const dateFilter: Record<string, Date> = {}
			if (filters.startDate) {
				dateFilter.$gte = filters.startDate
			}
			if (filters.endDate) {
				dateFilter.$lte = filters.endDate
			}
			if (!filters.status || filters.status === "All") {
				query.createdAt = dateFilter
			} else {
				// Specific status: filter by that status's "at" date (Wishlisted at, Applied at, etc.) via aggregation
				return this._getAllWithStatusDateAggregation(
					userId,
					filters,
					dateFilter,
					skip,
					limit,
					page
				)
			}
		}

		// Build sort object
		const sortField = filters.sortBy || "application_date"
		const sortOrder = filters.sortOrder === "asc" ? 1 : -1
		const sort: Record<string, 1 | -1> = { [sortField]: sortOrder }

		const [applications, totalCount] = await Promise.all([
			JobApplication.find(query).sort(sort).skip(skip).limit(limit).lean(),
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

	/**
	 * When a specific status is selected with a date range, filter by that status's
	 * "at" date (Wishlisted at, Applied at, etc.): from status_history, or
	 * application_date for Applied, or createdAt as fallback.
	 */
	private static async _getAllWithStatusDateAggregation(
		userId: string,
		filters: JobApplicationFilters,
		dateFilter: Record<string, Date>,
		skip: number,
		limit: number,
		page: number
	): Promise<PaginatedJobApplications> {
		const sortField = filters.sortBy || "application_date"
		const sortOrder = filters.sortOrder === "asc" ? 1 : -1

		const matchStage: Record<string, unknown> = {
			user_id: new mongoose.Types.ObjectId(userId),
			status: filters.status,
		}
		if (filters.priority) {
			matchStage.priority = filters.priority
		}
		if (filters.search) {
			matchStage.$or = [
				{ company_name: { $regex: filters.search, $options: "i" } },
				{ job_title: { $regex: filters.search, $options: "i" } },
			]
		} else if (filters.company_name) {
			matchStage.company_name = { $regex: filters.company_name, $options: "i" }
		}

		const pipeline: mongoose.PipelineStage[] = [
			{ $match: matchStage },
			{
				$lookup: {
					from: "statushistories",
					localField: "_id",
					foreignField: "job_application_id",
					as: "status_history_raw",
				},
			},
			{
				$addFields: {
					status_history: {
						$map: {
							input: "$status_history_raw",
							as: "e",
							in: {
								status: "$$e.status",
								changed_at: "$$e.changed_at",
							},
						},
					},
					effectiveDate: {
						$let: {
							vars: {
								matching: {
									$filter: {
										input: "$status_history_raw",
										as: "e",
										cond: { $eq: ["$$e.status", "$status"] },
									},
								},
							},
							in: {
								$cond: [
									{ $gt: [{ $size: "$$matching" }, 0] },
									{
										$max: {
											$map: {
												input: "$$matching",
												as: "e",
												in: "$$e.changed_at",
											},
										},
									},
									{
										$cond: [
											{ $eq: ["$status", "Applied"] },
											"$application_date",
											"$createdAt",
										],
									},
								],
							},
						},
					},
				},
			},
			{ $match: { effectiveDate: dateFilter } },
			{ $sort: { [sortField]: sortOrder } },
			{
				$facet: {
					total: [{ $count: "count" }],
					data: [
						{ $skip: skip },
						{ $limit: limit },
						{ $project: { status_history_raw: 0, effectiveDate: 0 } },
					],
				},
			},
		]

		const result = await JobApplication.aggregate(pipeline)
		const doc = result[0] as
			| { total?: Array<{ count: number }>; data?: unknown[] }
			| undefined
		const totalCount = doc?.total?.[0]?.count ?? 0
		const applications = (doc?.data ?? []) as IJobApplicationWithHistory[]

		const totalPages = Math.ceil(totalCount / limit)

		return {
			applications,
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
		const application = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		}).lean()

		if (!application) {
			return false
		}

		const deletePromises: Promise<unknown>[] = []

		if (
			application.resume_url &&
			fileUploadService.isProviderUrl(application.resume_url)
		) {
			deletePromises.push(
				fileUploadService
					.deleteFile(application.resume_url, "raw")
					.catch((error) => {
						logger.error("Failed to delete resume from CDN:", error)
					})
			)
		}

		if (
			application.cover_letter_url &&
			fileUploadService.isProviderUrl(application.cover_letter_url)
		) {
			deletePromises.push(
				fileUploadService
					.deleteFile(application.cover_letter_url, "raw")
					.catch((error) => {
						logger.error("Failed to delete cover letter from CDN:", error)
					})
			)
		}

		await Promise.allSettled(deletePromises)

		// Delete the job application. StatusHistory, Interview, and
		// ApplicationContact are cascade-deleted by the model's pre hook.
		const deletePromise = JobApplication.deleteOne({
			_id: jobApplicationId,
			user_id: userId,
		})
		deletePromises.push(deletePromise)

		const result = await Promise.allSettled(deletePromises)
		const success = result.every((r) => r.status === "fulfilled")
		if (success) {
			logger.info("Job application deleted with cascade", {
				jobApplicationId,
				userId,
			})
		} else {
			logger.error("Failed to delete job application with cascade", {
				jobApplicationId,
				userId,
				result,
			})
		}
		return success
	}
}
