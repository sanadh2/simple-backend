import mongoose, { Document, Schema } from "mongoose"

import type { JobStatus } from "./JobApplication.js"

export interface IStatusHistory extends Document {
	job_application_id: mongoose.Types.ObjectId
	status: JobStatus
	changed_at: Date
	createdAt: Date
	updatedAt: Date
}

const statusHistorySchema = new Schema<IStatusHistory>(
	{
		job_application_id: {
			type: Schema.Types.ObjectId,
			ref: "JobApplication",
			required: [true, "Job application ID is required"],
			index: true,
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
			index: true,
		},
		changed_at: {
			type: Date,
			required: [true, "Changed at date is required"],
			default: Date.now,
			index: true,
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

statusHistorySchema.index({ job_application_id: 1, changed_at: -1 })

export const StatusHistory = mongoose.model<IStatusHistory>(
	"StatusHistory",
	statusHistorySchema
)
