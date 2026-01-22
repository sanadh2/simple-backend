import mongoose, { Document, Schema } from "mongoose"

import type { DeviceInfo } from "../types/deviceFingerprint.js"

/**
 * Device Fingerprint Model Interface
 * Represents a device fingerprint stored in the database
 */
export interface IDeviceFingerprint extends Document {
	/** SHA-256 hash of the device info - used as unique identifier */
	fingerprintHash: string
	/** Detailed device information */
	deviceInfo: DeviceInfo
	/** Optional user ID to associate the fingerprint with */
	userId?: mongoose.Types.ObjectId
	/** Optional session ID to link the fingerprint to */
	sessionId?: string
	/** Type of event that triggered the fingerprint capture */
	eventType: string
	/** Timestamp when this fingerprint was created */
	createdAt: Date
	/** Timestamp when this fingerprint was last updated */
	updatedAt: Date
}

/**
 * Device Fingerprint Schema
 * Stores device fingerprints for user identification and security tracking
 */
const deviceFingerprintSchema = new Schema<IDeviceFingerprint>(
	{
		fingerprintHash: {
			type: String,
			required: [true, "Fingerprint hash is required"],
			index: true,
		},
		deviceInfo: {
			ip: {
				type: String,
				required: true,
			},
			browserName: String,
			browserVersion: String,
			osName: String,
			osVersion: String,
			deviceType: String,
			acceptLanguage: String,
			acceptEncoding: String,
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

// Create compound indexes for common query patterns
deviceFingerprintSchema.index({ fingerprintHash: 1, userId: 1 })
deviceFingerprintSchema.index({ userId: 1, createdAt: -1 })

export const DeviceFingerprint = mongoose.model<IDeviceFingerprint>(
	"DeviceFingerprint",
	deviceFingerprintSchema
)
