import mongoose, { Document, Schema } from "mongoose"

export interface IBookmark extends Document {
	userId: mongoose.Types.ObjectId
	url: string
	title: string
	description?: string
	tags: string[]
	aiGenerated: boolean
	favicon?: string
	createdAt: Date
	updatedAt: Date
}

const bookmarkSchema = new Schema<IBookmark>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		url: {
			type: String,
			required: true,
			trim: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
		},
		tags: {
			type: [String],
			default: [],
			index: true,
		},
		aiGenerated: {
			type: Boolean,
			default: false,
		},
		favicon: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
)

bookmarkSchema.index({ userId: 1, url: 1 }, { unique: true })
bookmarkSchema.index({ userId: 1, tags: 1 })
bookmarkSchema.index({ userId: 1, createdAt: -1 })

export const Bookmark = mongoose.model<IBookmark>("Bookmark", bookmarkSchema)
