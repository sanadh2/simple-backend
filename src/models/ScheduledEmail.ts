import mongoose, { Document, Schema } from "mongoose"

export type ScheduledEmailType = "follow_up" | "interview"
export type ScheduledEmailParentType = "ApplicationContact" | "Interview"
export type ScheduledEmailStatus = "pending" | "sent" | "failed"

export interface IScheduledEmail extends Document {
	type: ScheduledEmailType
	parent_type: ScheduledEmailParentType
	parent_id: mongoose.Types.ObjectId
	job_application_id: mongoose.Types.ObjectId
	user_id: mongoose.Types.ObjectId
	scheduled_for: Date
	status: ScheduledEmailStatus
	sent_at?: Date
	failure_message?: string
	meta: {
		company_name?: string
		job_title?: string
		contact_name?: string
		interview_type?: string
		interview_format?: string
	}
	createdAt: Date
	updatedAt: Date
}

const scheduledEmailSchema = new Schema<IScheduledEmail>(
	{
		type: {
			type: String,
			enum: ["follow_up", "interview"],
			required: true,
			index: true,
		},
		parent_type: {
			type: String,
			enum: ["ApplicationContact", "Interview"],
			required: true,
			index: true,
		},
		parent_id: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		job_application_id: {
			type: Schema.Types.ObjectId,
			ref: "JobApplication",
			required: true,
			index: true,
		},
		user_id: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		scheduled_for: {
			type: Date,
			required: true,
			index: true,
		},
		status: {
			type: String,
			enum: ["pending", "sent", "failed"],
			required: true,
			default: "pending",
			index: true,
		},
		sent_at: { type: Date },
		failure_message: { type: String },
		meta: {
			type: Schema.Types.Mixed,
			default: {},
		},
	},
	{ timestamps: true }
)

scheduledEmailSchema.index({ user_id: 1, status: 1, scheduled_for: 1 })
scheduledEmailSchema.index({ parent_type: 1, parent_id: 1 })
scheduledEmailSchema.index({ job_application_id: 1 })

export const ScheduledEmail = mongoose.model<IScheduledEmail>(
	"ScheduledEmail",
	scheduledEmailSchema
)
