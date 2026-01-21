import mongoose, { Document, Schema } from "mongoose"

import { Interview } from "./Interview"
import { StatusHistory } from "./StatusHistory"

export type JobStatus =
	| "Wishlist"
	| "Applied"
	| "Interview Scheduled"
	| "Interviewing"
	| "Offer"
	| "Rejected"
	| "Accepted"
	| "Withdrawn"

export type LocationType = "remote" | "hybrid" | "onsite"

export type PriorityLevel = "high" | "medium" | "low"

export interface IJobApplication extends Document {
	user_id: mongoose.Types.ObjectId
	company_id?: mongoose.Types.ObjectId
	company_name: string
	job_title: string
	job_description?: string
	notes?: string
	application_date: Date
	status: JobStatus
	salary_range?: string
	location_type: LocationType
	location_city?: string
	job_posting_url?: string
	application_method?: string
	priority: PriorityLevel
	resume_url?: string
	cover_letter_url?: string
	createdAt: Date
	updatedAt: Date
}

const jobApplicationSchema = new Schema<IJobApplication>(
	{
		user_id: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
			index: true,
		},
		company_id: {
			type: Schema.Types.ObjectId,
			ref: "Company",
			index: true,
		},
		company_name: {
			type: String,
			required: [true, "Company name is required"],
			trim: true,
		},
		job_title: {
			type: String,
			required: [true, "Job title is required"],
			trim: true,
		},
		job_description: {
			type: String,
			trim: true,
		},
		notes: {
			type: String,
			trim: true,
		},
		application_date: {
			type: Date,
			required: [true, "Application date is required"],
			default: Date.now,
		},
		status: {
			type: String,
			enum: [
				"Wishlist",
				"Applied",
				"Interview Scheduled",
				"Interviewing",
				"Offer",
				"Rejected",
				"Accepted",
				"Withdrawn",
			],
			required: [true, "Status is required"],
			default: "Wishlist",
		},
		salary_range: {
			type: String,
			trim: true,
		},
		location_type: {
			type: String,
			enum: ["remote", "hybrid", "onsite"],
			required: [true, "Location type is required"],
		},
		location_city: {
			type: String,
			trim: true,
		},
		job_posting_url: {
			type: String,
			trim: true,
		},
		application_method: {
			type: String,
			trim: true,
		},
		priority: {
			type: String,
			enum: ["high", "medium", "low"],
			required: [true, "Priority is required"],
			default: "medium",
		},
		resume_url: {
			type: String,
			trim: true,
		},
		cover_letter_url: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: (_doc, ret: Record<string, unknown>) => {
				const cleaned = { ...ret }
				delete cleaned.__v
				return cleaned
			},
		},
	}
)

jobApplicationSchema.index({ user_id: 1, application_date: -1 })
jobApplicationSchema.index({ user_id: 1, status: 1 })
jobApplicationSchema.index({ user_id: 1, company_name: 1 })
jobApplicationSchema.index({ user_id: 1, company_id: 1 })

jobApplicationSchema.pre(
	["deleteOne", "findOneAndDelete"],
	{ document: false, query: true },
	async function () {
		const filter = this.getFilter() as Record<string, unknown>
		const jobApplicationId = filter._id as
			| mongoose.Types.ObjectId
			| string
			| undefined

		if (!jobApplicationId) {
			return
		}

		const applicationId =
			typeof jobApplicationId === "string"
				? new mongoose.Types.ObjectId(jobApplicationId)
				: jobApplicationId

		// Delete related status history records
		await StatusHistory.deleteMany({
			job_application_id: applicationId,
		})

		// Delete related interviews
		await Interview.deleteMany({
			job_application_id: applicationId,
		})
	}
)

export const JobApplication = mongoose.model<IJobApplication>(
	"JobApplication",
	jobApplicationSchema
)
