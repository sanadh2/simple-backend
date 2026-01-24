import mongoose, { Document, Schema } from "mongoose"

export interface IInteraction extends Document {
	application_contact_id: mongoose.Types.ObjectId
	date: Date
	type?: string
	notes?: string
	createdAt: Date
	updatedAt: Date
}

const interactionSchema = new Schema<IInteraction>(
	{
		application_contact_id: {
			type: Schema.Types.ObjectId,
			ref: "ApplicationContact",
			required: [true, "Application contact ID is required"],
			index: true,
		},
		date: {
			type: Date,
			required: true,
			default: Date.now,
		},
		type: {
			type: String,
			trim: true,
		},
		notes: {
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

interactionSchema.index({ application_contact_id: 1, date: -1 })

export const Interaction = mongoose.model<IInteraction>(
	"Interaction",
	interactionSchema
)
