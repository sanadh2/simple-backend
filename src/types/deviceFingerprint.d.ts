/**
 * Detailed device information extracted from the request
 * This contains all the raw data we collect before hashing
 */
export interface DeviceInfo {
	/** IP address of the client */
	ip: string
	/** Client-side fingerprint from FingerprintJS (visitor ID) */
	clientFingerprint: string | undefined
	/** Browser name (e.g., "Chrome", "Firefox", "Safari") */
	browserName: string | undefined
	/** Browser version (e.g., "120.0.0.0") */
	browserVersion: string | undefined
	/** Operating system name (e.g., "Windows", "Mac OS", "Linux") */
	osName: string | undefined
	/** Operating system version (e.g., "10", "14.2.1") */
	osVersion: string | undefined
	/** Device type (e.g., "mobile", "tablet", "desktop") */
	deviceType: string | undefined
	/** Accept-Language header value (e.g., "en-US,en;q=0.9") */
	acceptLanguage: string | undefined
	/** Accept-Encoding header value (e.g., "gzip, deflate, br") */
	acceptEncoding: string | undefined
}

/**
 * Device fingerprint data structure
 * Contains both the hash (for quick lookups) and detailed info (for analysis)
 */
export interface DeviceFingerprint {
	/** SHA-256 hash of the device info - used as unique identifier */
	fingerprintHash: string
	/** Detailed device information */
	deviceInfo: DeviceInfo
	/** Timestamp when this fingerprint was created */
	createdAt: Date
}

/**
 * Extend Express Request to include device fingerprint data
 * This allows us to access req.deviceFingerprint throughout the application
 */
declare module "express-serve-static-core" {
	interface Request {
		deviceFingerprint?: DeviceFingerprint
	}
}
