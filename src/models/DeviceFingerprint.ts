import mongoose, { Document, Schema } from "mongoose"

export interface IDeviceFingerprint extends Document {
	fingerprintHash: string
	ip: string
	client_fingerprint?: string
	browser_name?: string
	browser_version?: string
	os_name?: string
	os_version?: string
	device_type?: string
	accept_language?: string
	accept_encoding?: string
	userId?: mongoose.Types.ObjectId
	sessionId?: string
	eventType: string
	createdAt: Date
	updatedAt: Date
}

const deviceFingerprintSchema = new Schema<IDeviceFingerprint>(
	{
		fingerprintHash: {
			type: String,
			required: [true, "Fingerprint hash is required"],
			index: true,
		},
		ip: {
			type: String,
			required: [true, "IP is required"],
		},
		client_fingerprint: {
			type: String,
			trim: true,
		},
		browser_name: {
			type: String,
			trim: true,
		},
		browser_version: {
			type: String,
			trim: true,
		},
		os_name: {
			type: String,
			trim: true,
		},
		os_version: {
			type: String,
			trim: true,
		},
		device_type: {
			type: String,
			trim: true,
		},
		accept_language: {
			type: String,
			trim: true,
		},
		accept_encoding: {
			type: String,
			trim: true,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			index: true,
		},
		sessionId: {
			type: String,
			index: true,
		},
		eventType: {
			type: String,
			default: "unknown",
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

deviceFingerprintSchema.index({ fingerprintHash: 1, userId: 1 })
deviceFingerprintSchema.index({ userId: 1, createdAt: -1 })

export const DeviceFingerprint = mongoose.model<IDeviceFingerprint>(
	"DeviceFingerprint",
	deviceFingerprintSchema
)
