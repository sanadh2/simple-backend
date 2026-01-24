import mongoose, { Document, Schema } from "mongoose"

import { Interaction } from "./Interaction.js"

export interface IApplicationContact extends Document {
	job_application_id: mongoose.Types.ObjectId
	name: string
	role?: string
	email?: string
	phone?: string
	linkedin_url?: string
	last_contacted_at?: Date
	follow_up_reminder_at?: Date
	follow_up_reminder_sent_at?: Date
	createdAt: Date
	updatedAt: Date
}

const applicationContactSchema = new Schema<IApplicationContact>(
	{
		job_application_id: {
			type: Schema.Types.ObjectId,
			ref: "JobApplication",
			required: [true, "Job application ID is required"],
			index: true,
		},
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
		},
		role: {
			type: String,
			trim: true,
		},
		email: {
			type: String,
			trim: true,
		},
		phone: {
			type: String,
			trim: true,
		},
		linkedin_url: {
			type: String,
			trim: true,
		},
		last_contacted_at: {
			type: Date,
		},
		follow_up_reminder_at: {
			type: Date,
		},
		follow_up_reminder_sent_at: {
			type: Date,
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

applicationContactSchema.index({ follow_up_reminder_at: 1 })

applicationContactSchema.pre(
	["deleteOne", "findOneAndDelete"],
	{ document: false, query: true },
	async function () {
		const filter = this.getFilter() as Record<string, unknown>
		const contactId = filter._id as mongoose.Types.ObjectId | string | undefined
		if (!contactId) return
		const id =
			typeof contactId === "string"
				? new mongoose.Types.ObjectId(contactId)
				: contactId
		await Interaction.deleteMany({ application_contact_id: id })
	}
)

export const ApplicationContact = mongoose.model<IApplicationContact>(
	"ApplicationContact",
	applicationContactSchema
)
