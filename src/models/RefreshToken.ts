import mongoose, { Document, Schema } from "mongoose"

export interface IRefreshToken extends Document {
	user_id: mongoose.Types.ObjectId
	token: string
	createdAt: Date
	updatedAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
	{
		user_id: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
			index: true,
		},
		token: {
			type: String,
			required: [true, "Token is required"],
			trim: true,
			index: true,
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: (_doc, ret: Record<string, unknown>) => {
				const cleaned = { ...ret }
				delete cleaned.__v
				delete cleaned.token
				return cleaned
			},
		},
	}
)

refreshTokenSchema.index({ user_id: 1, token: 1 }, { unique: true })

export const RefreshToken = mongoose.model<IRefreshToken>(
	"RefreshToken",
	refreshTokenSchema
)
