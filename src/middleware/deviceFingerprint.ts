import { createHash } from "node:crypto"

import { type NextFunction, type Request, type Response } from "express"
import { getClientIp } from "request-ip"
import { UAParser } from "ua-parser-js"

import type {
	DeviceFingerprint,
	DeviceInfo,
} from "../types/deviceFingerprint.js"
import { logger } from "../utils/logger.js"

/**
 * Device Fingerprinting Middleware
 *
 * This middleware extracts various signals from the incoming HTTP request
 * to create a unique "fingerprint" that can identify a device/browser combination.
 *
 * How it works:
 * 1. Extracts IP address from the request (handles proxies correctly)
 * 2. Parses the User-Agent header to get browser and OS information
 * 3. Captures Accept-Language and Accept-Encoding headers
 * 4. Combines all this data into a JSON object
 * 5. Creates a SHA-256 hash of that JSON to generate a unique fingerprint
 * 6. Stores both the hash and detailed info in req.deviceFingerprint
 *
 * Use cases:
 * - Track devices for security (detect suspicious logins from new devices)
 * - Analytics (understand what devices/browsers users are using)
 * - Fraud prevention (identify patterns in device usage)
 *
 * Note: This fingerprint is not 100% unique - users can change browsers,
 * use VPNs, or clear cookies. It's best used as one signal among many.
 */
export const deviceFingerprintMiddleware = (
	req: Request,
	_res: Response,
	next: NextFunction
) => {
	try {
		// Step 1: Extract IP address from the request
		// getClientIp() handles various proxy headers (X-Forwarded-For, etc.)
		// and returns the actual client IP address
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const clientIp = getClientIp(req) as string | null
		const ip = clientIp || req.ip || "unknown"

		// Step 2: Parse the User-Agent header
		// The User-Agent string contains information about the browser and OS
		// Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
		const userAgentString = req.headers["user-agent"] || ""
		// Create a UAParser instance and get the parsed result
		// This extracts browser, OS, and device information from the User-Agent string
		const parser = new UAParser(userAgentString)
		const uaResult = parser.getResult()

		// Extract browser information
		// uaResult.browser.name gives us "Chrome", "Firefox", "Safari", etc.
		// uaResult.browser.version gives us the version number
		const browserName = uaResult.browser?.name
		const browserVersion = uaResult.browser?.version

		// Extract OS information
		// uaResult.os.name gives us "Windows", "Mac OS", "Linux", "Android", "iOS", etc.
		// uaResult.os.version gives us the OS version
		const osName = uaResult.os?.name
		const osVersion = uaResult.os?.version

		// Extract device type
		// uaResult.device.type gives us "mobile", "tablet", "desktop", or undefined
		// If undefined, we infer from the OS (e.g., iOS/Android = mobile)
		let deviceType = uaResult.device?.type
		if (!deviceType) {
			if (osName === "iOS" || osName === "Android") {
				deviceType = "mobile"
			} else {
				deviceType = "desktop"
			}
		}

		// Step 3: Capture HTTP headers that can help identify the device
		// Accept-Language: Shows the user's preferred languages
		// Accept-Encoding: Shows what compression methods the browser supports
		const acceptLanguage = req.headers["accept-language"]
		const acceptEncoding = req.headers["accept-encoding"]

		// Step 4: Combine all the collected information into a structured object
		// We normalize values to ensure consistent hashing (undefined becomes null)
		const deviceInfo: DeviceInfo = {
			ip: typeof ip === "string" ? ip : "unknown",
			browserName: browserName ?? undefined,
			browserVersion: browserVersion ?? undefined,
			osName: osName ?? undefined,
			osVersion: osVersion ?? undefined,
			deviceType: deviceType ?? undefined,
			acceptLanguage:
				typeof acceptLanguage === "string" ? acceptLanguage : undefined,
			acceptEncoding:
				typeof acceptEncoding === "string" ? acceptEncoding : undefined,
		}

		// Step 5: Create a deterministic JSON string from the device info
		// We sort the keys to ensure consistent ordering (important for hashing)
		// This ensures the same device info always produces the same hash
		const deviceInfoString = JSON.stringify(
			deviceInfo,
			Object.keys(deviceInfo).sort()
		)

		// Step 6: Generate SHA-256 hash of the device info
		// SHA-256 is a cryptographic hash function that produces a unique
		// 64-character hexadecimal string for any given input
		// Same input = same hash, different input = different hash (with extremely high probability)
		const fingerprintHash = createHash("sha256")
			.update(deviceInfoString)
			.digest("hex")

		// Step 7: Create the complete fingerprint object
		// We store both the hash (for quick lookups) and the detailed info (for analysis)
		const deviceFingerprint: DeviceFingerprint = {
			fingerprintHash,
			deviceInfo,
			createdAt: new Date(),
		}

		// Step 8: Attach the fingerprint to the request object
		// This makes it available throughout the request lifecycle
		req.deviceFingerprint = deviceFingerprint

		// Log the fingerprint creation for debugging (optional)
		logger.debug("Device fingerprint created", {
			fingerprintHash,
			ip,
			browserName,
			osName,
			deviceType,
		})

		next()
	} catch (error) {
		// If fingerprinting fails, log the error but don't block the request
		// This ensures the application continues to work even if fingerprinting has issues
		logger.error("Error creating device fingerprint", {
			error: error instanceof Error ? error.message : "Unknown error",
			url: req.originalUrl,
		})
		next()
	}
}
