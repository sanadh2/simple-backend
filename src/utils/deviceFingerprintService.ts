import mongoose from "mongoose"

import { DeviceFingerprint } from "../models/index.js"
import type { DeviceFingerprint as DeviceFingerprintType } from "../types/deviceFingerprint.js"
import { logger } from "./logger.js"

/**
 * Device Fingerprint Service
 *
 * Utility functions for saving and managing device fingerprints in the database.
 *
 * This service provides functions that you can call from your authentication
 * handlers, session management, or any other place where you want to track devices.
 */

/**
 * Save device fingerprint to database alongside user sessions or authentication events
 *
 * This function is designed to be called when:
 * - A user logs in (to track which device they're using)
 * - A user registers (to record their initial device)
 * - A session is created (to link the session to a device)
 * - Any security-sensitive event occurs (to maintain an audit trail)
 *
 * @param fingerprint - The device fingerprint object from req.deviceFingerprint
 * @param userId - Optional user ID to associate the fingerprint with
 * @param sessionId - Optional session ID to link the fingerprint to
 * @param eventType - Type of event (e.g., "login", "register", "session_created")
 *
 * @returns Promise that resolves when the fingerprint is saved
 *
 * Example usage in an auth controller:
 * ```typescript
 * // After successful login
 * await saveDeviceFingerprint(
 *   req.deviceFingerprint!,
 *   user._id.toString(),
 *   req.sessionID,
 *   "login"
 * )
 * ```
 */
export async function saveDeviceFingerprint(
	fingerprint: DeviceFingerprintType,
	userId?: string,
	sessionId?: string,
	eventType: string = "unknown"
): Promise<void> {
	try {
		const d = fingerprint.deviceInfo
		const fingerprintData: Record<string, unknown> = {
			fingerprintHash: fingerprint.fingerprintHash,
			ip: d.ip,
			client_fingerprint: d.clientFingerprint,
			browser_name: d.browserName,
			browser_version: d.browserVersion,
			os_name: d.osName,
			os_version: d.osVersion,
			device_type: d.deviceType,
			accept_language: d.acceptLanguage,
			accept_encoding: d.acceptEncoding,
			eventType,
		}
		if (userId) {
			fingerprintData.userId = new mongoose.Types.ObjectId(userId)
		}
		if (sessionId) {
			fingerprintData.sessionId = sessionId
		}
		await DeviceFingerprint.create(fingerprintData)

		logger.info("Device fingerprint saved to database", {
			fingerprintHash: fingerprint.fingerprintHash,
			userId,
			sessionId,
			eventType,
		})
	} catch (error) {
		// Log the error but don't throw - we don't want fingerprinting failures
		// to break the main application flow
		logger.error("Failed to save device fingerprint", {
			error: error instanceof Error ? error.message : "Unknown error",
			fingerprintHash: fingerprint.fingerprintHash,
			userId,
		})
	}
}

/**
 * Extended device fingerprint type that includes eventType
 */
export interface DeviceFingerprintWithEvent extends DeviceFingerprintType {
	eventType: string
}

/**
 * Find all fingerprints associated with a user
 * Useful for showing users their login history or device list
 *
 * @param userId - The user ID to look up
 * @returns Promise that resolves to an array of device fingerprints with eventType
 */
export async function getUserDeviceFingerprints(
	userId: string
): Promise<DeviceFingerprintWithEvent[]> {
	try {
		logger.debug("Getting device fingerprints for user", { userId })

		const userObjectId = new mongoose.Types.ObjectId(userId)
		const fingerprints = await DeviceFingerprint.find({
			userId: userObjectId,
		})
			.sort({ createdAt: -1 })
			.lean()

		// Transform database documents to match DeviceFingerprintType interface
		// Include eventType from the database
		const transformedFingerprints: DeviceFingerprintWithEvent[] =
			fingerprints.map((fp) => ({
				fingerprintHash: fp.fingerprintHash,
				deviceInfo: {
					ip: fp.ip,
					clientFingerprint: fp.client_fingerprint,
					browserName: fp.browser_name,
					browserVersion: fp.browser_version,
					osName: fp.os_name,
					osVersion: fp.os_version,
					deviceType: fp.device_type,
					acceptLanguage: fp.accept_language,
					acceptEncoding: fp.accept_encoding,
				},
				createdAt: fp.createdAt,
				eventType: fp.eventType || "unknown",
			}))

		logger.debug("Device fingerprints retrieved", {
			userId,
			count: transformedFingerprints.length,
		})

		return transformedFingerprints
	} catch (error) {
		logger.error("Failed to get user device fingerprints", {
			error: error instanceof Error ? error.message : "Unknown error",
			userId,
		})
		return []
	}
}

/**
 * Check if a fingerprint has been seen before
 * Useful for detecting if a user is logging in from a new device
 *
 * @param fingerprintHash - The fingerprint hash to check
 * @param userId - Optional user ID to scope the check
 * @returns Promise that resolves to true if the fingerprint exists
 */
export async function fingerprintExists(
	fingerprintHash: string,
	userId?: string
): Promise<boolean> {
	try {
		// Build the query object
		// We always check for the fingerprintHash
		const query: {
			fingerprintHash: string
			userId?: mongoose.Types.ObjectId
		} = {
			fingerprintHash,
		}

		// If userId is provided, scope the check to that specific user
		// This allows us to check if a user has logged in from this device before
		if (userId) {
			query.userId = new mongoose.Types.ObjectId(userId)
		}

		// Use countDocuments for efficient existence check
		// Returns 0 if not found, > 0 if found
		const count = await DeviceFingerprint.countDocuments(query)

		logger.debug("Fingerprint existence check completed", {
			fingerprintHash,
			userId,
			exists: count > 0,
		})

		return count > 0
	} catch (error) {
		// Log the error but don't throw - we don't want fingerprinting failures
		// to break the main application flow
		logger.error("Failed to check fingerprint existence", {
			error: error instanceof Error ? error.message : "Unknown error",
			fingerprintHash,
			userId,
		})
		// Return false on error to be safe (assume fingerprint doesn't exist)
		return false
	}
}
