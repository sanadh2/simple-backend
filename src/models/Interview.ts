import mongoose, { Document, Schema } from "mongoose"

import { InterviewChecklistItem } from "./InterviewChecklistItem.js"

export type InterviewType =
	| "phone_screen"
	| "technical"
	| "behavioral"
	| "system_design"
	| "hr"
	| "final"

export type InterviewFormat = "phone" | "video" | "in_person"

export interface IInterview extends Document {
	job_application_id: mongoose.Types.ObjectId
	interview_type: InterviewType
	scheduled_at: Date
	interviewer_name?: string
	interviewer_role?: string
	interview_format: InterviewFormat
	duration_minutes?: number
	notes?: string
	feedback?: string
	createdAt: Date
	updatedAt: Date
}

const interviewSchema = new Schema<IInterview>(
	{
		job_application_id: {
			type: Schema.Types.ObjectId,
			ref: "JobApplication",
			required: [true, "Job application ID is required"],
			index: true,
		},
		interview_type: {
			type: String,
			enum: [
				"phone_screen",
				"technical",
				"behavioral",
				"system_design",
				"hr",
				"final",
			],
			required: [true, "Interview type is required"],
			index: true,
		},
		scheduled_at: {
			type: Date,
			required: [true, "Scheduled date and time is required"],
		},
		interviewer_name: {
			type: String,
			trim: true,
		},
		interviewer_role: {
			type: String,
			trim: true,
		},
		interview_format: {
			type: String,
			enum: ["phone", "video", "in_person"],
			required: [true, "Interview format is required"],
		},
		duration_minutes: {
			type: Number,
			min: [1, "Duration must be at least 1 minute"],
		},
		notes: {
			type: String,
			trim: true,
		},
		feedback: {
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

interviewSchema.index({ job_application_id: 1, scheduled_at: -1 })
interviewSchema.index({ job_application_id: 1, interview_type: 1 })
interviewSchema.index({ scheduled_at: 1 })

interviewSchema.pre(
	["deleteOne", "findOneAndDelete"],
	{ document: false, query: true },
	async function () {
		const filter = this.getFilter() as Record<string, unknown>
		const interviewId = filter._id as
			| mongoose.Types.ObjectId
			| string
			| undefined
		if (!interviewId) return
		const id =
			typeof interviewId === "string"
				? new mongoose.Types.ObjectId(interviewId)
				: interviewId
		await InterviewChecklistItem.deleteMany({ interview_id: id })
	}
)

export const Interview = mongoose.model<IInterview>(
	"Interview",
	interviewSchema
)
