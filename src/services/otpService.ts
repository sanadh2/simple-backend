import crypto from "crypto"

import { env } from "../config/env.js"

export class OTPService {
	static generateOTP(): string {
		const length = env.OTP_LENGTH
		const min = Math.pow(10, length - 1)
		const max = Math.pow(10, length) - 1
		const otp = crypto.randomInt(min, max + 1)
		return otp.toString().padStart(length, "0")
	}

	static getOTPExpiry(): Date {
		const expiryMinutes = env.OTP_EXPIRY_MINUTES
		const expiryDate = new Date()
		expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes)
		return expiryDate
	}

	static isOTPExpired(expiryDate: Date | undefined): boolean {
		if (!expiryDate) {
			return true
		}
		return new Date() > expiryDate
	}

	static verifyOTP(
		providedOTP: string,
		storedOTP: string | undefined,
		expiryDate: Date | undefined
	): boolean {
		if (!storedOTP || !expiryDate) {
			return false
		}

		if (this.isOTPExpired(expiryDate)) {
			return false
		}

		const normalizedProvided = providedOTP.trim().padStart(env.OTP_LENGTH, "0")
		const normalizedStored = storedOTP.trim().padStart(env.OTP_LENGTH, "0")

		if (normalizedProvided.length !== normalizedStored.length) {
			return false
		}

		return crypto.timingSafeEqual(
			Buffer.from(normalizedProvided),
			Buffer.from(normalizedStored)
		)
	}
}
