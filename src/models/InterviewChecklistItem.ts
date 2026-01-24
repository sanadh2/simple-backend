import mongoose, { Document, Schema } from "mongoose"

export interface IInterviewChecklistItem extends Document {
	interview_id: mongoose.Types.ObjectId
	item: string
	createdAt: Date
	updatedAt: Date
}

const interviewChecklistItemSchema = new Schema<IInterviewChecklistItem>(
	{
		interview_id: {
			type: Schema.Types.ObjectId,
			ref: "Interview",
			required: [true, "Interview ID is required"],
			index: true,
		},
		item: {
			type: String,
			required: [true, "Item is required"],
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

export const InterviewChecklistItem = mongoose.model<IInterviewChecklistItem>(
	"InterviewChecklistItem",
	interviewChecklistItemSchema
)
