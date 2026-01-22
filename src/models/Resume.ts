import mongoose, { Document, Schema } from "mongoose"

export interface IResume extends Document {
	user_id: mongoose.Types.ObjectId
	version: number
	description?: string
	file_url: string
	file_name?: string
	file_size?: number
	createdAt: Date
	updatedAt: Date
}

const resumeSchema = new Schema<IResume>(
	{
		user_id: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
			index: true,
		},
		version: {
			type: Number,
			required: [true, "Version is required"],
			min: 1,
		},
		description: {
			type: String,
			trim: true,
		},
		file_url: {
			type: String,
			required: [true, "File URL is required"],
			trim: true,
		},
		file_name: {
			type: String,
			trim: true,
		},
		file_size: {
			type: Number,
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

resumeSchema.index({ user_id: 1, version: 1 }, { unique: true })

resumeSchema.index({ user_id: 1, createdAt: -1 })

export const Resume = mongoose.model<IResume>("Resume", resumeSchema)
