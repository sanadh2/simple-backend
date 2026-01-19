import mongoose, { Document, Schema } from "mongoose"

export interface ILog extends Document {
	timestamp: Date
	level: "info" | "warn" | "error" | "debug"
	correlation_id: string
	message: string
	user_id?: string
	meta?: Record<string, unknown>
	createdAt: Date
}

const logSchema = new Schema<ILog>(
	{
		timestamp: {
			type: Date,
			required: true,
			index: true,
		},
		level: {
			type: String,
			required: true,
			enum: ["info", "warn", "error", "debug"],
			index: true,
		},
		correlation_id: {
			type: String,
			required: true,
			index: true,
		},
		message: {
			type: String,
			required: true,
		},
		user_id: {
			type: String,
			index: true,
		},
		meta: {
			type: Schema.Types.Mixed,
		},
	},
	{
		timestamps: { createdAt: true, updatedAt: false },
		capped: { size: 50 * 1024 * 1024, max: 100000 },
	}
)

logSchema.index({ timestamp: -1 })
logSchema.index({ level: 1, timestamp: -1 })
logSchema.index({ correlation_id: 1, timestamp: 1 })

export const Log = mongoose.model<ILog>("Log", logSchema)
