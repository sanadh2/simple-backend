/**
 * Cloudinary File Upload Service Implementation
 *
 * This file contains ALL Cloudinary-specific logic.
 * To switch to AWS S3 or another provider, only this file needs to change.
 */

import { v2 as cloudinary } from "cloudinary"

import { env } from "../config/env.js"
import type { FileUploadService, UploadResult } from "./fileUploadService.js"

cloudinary.config({
	cloud_name: env.CLOUDINARY_CLOUD_NAME,
	api_key: env.CLOUDINARY_API_KEY,
	api_secret: env.CLOUDINARY_API_SECRET,
})

class CloudinaryUploadService implements FileUploadService {
	/**
	 * Upload a file buffer to Cloudinary
	 */
	async uploadFile(
		buffer: Buffer,
		filename: string,
		folder: string,
		userId: string
	): Promise<UploadResult> {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
		const publicId = `${folder}/${userId}-${uniqueSuffix}`

		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					public_id: publicId,
					folder: folder,
					resource_type: "image",
					allowed_formats: ["jpg", "jpeg", "png", "webp"],
					transformation: [
						{
							width: 800,
							height: 800,
							crop: "limit",
							quality: "auto",
							fetch_format: "auto",
						},
					],
					use_filename: false,
					unique_filename: false,
				},
				(error, result) => {
					if (error) {
						let errorMessage = "Unknown error"

						if (error instanceof Error) {
							errorMessage = error.message
						} else if (typeof error === "object" && error !== null) {
							const cloudinaryError = error as {
								http_code?: number
								message?: string
								error?: { message?: string }
							}
							errorMessage =
								cloudinaryError.message ||
								cloudinaryError.error?.message ||
								JSON.stringify(cloudinaryError)
						} else if (typeof error === "string") {
							errorMessage = error
						}

						const errorDetails = {
							errorType: typeof error,
							httpCode: (error as { http_code?: number })?.http_code,
							...(typeof error === "object" && error !== null
								? { error: JSON.stringify(error) }
								: { error: String(error) }),
						}
						console.error("Cloudinary upload error details:", errorDetails)

						reject(new Error(`Cloudinary upload failed: ${errorMessage}`))
						return
					}

					if (!result) {
						reject(new Error("Cloudinary upload returned no result"))
						return
					}

					resolve({
						url: result.secure_url,
						publicId: result.public_id,
					})
				}
			)

			uploadStream.end(buffer)
		})
	}

	/**
	 * Get image format from filename
	 */
	private getImageFormat(filename: string): string {
		const ext = filename.toLowerCase().split(".").pop() || "jpg"
		if (ext === "jpg" || ext === "jpeg") return "jpeg"
		if (ext === "png") return "png"
		if (ext === "webp") return "webp"
		return "jpeg" // default
	}

	/**
	 * Delete a file from Cloudinary
	 */
	async deleteFile(urlOrPublicId: string): Promise<void> {
		try {
			const publicId = this.extractPublicId(urlOrPublicId) || urlOrPublicId

			await cloudinary.uploader.destroy(publicId, {
				resource_type: "image",
			})
		} catch (error) {
			console.error("Failed to delete file from Cloudinary:", error)
		}
	}

	/**
	 * Check if a URL is from Cloudinary
	 */
	isProviderUrl(url: string): boolean {
		return url.includes("cloudinary.com") || url.includes("res.cloudinary.com")
	}

	/**
	 * Extract public ID from Cloudinary URL
	 * Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{ext}
	 */
	extractPublicId(url: string): string | null {
		if (!this.isProviderUrl(url)) {
			return null
		}

		try {
			const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
			if (match && match[1]) {
				return match[1]
			}

			const urlParts = url.split("/")
			const filename = urlParts[urlParts.length - 1]
			if (!filename || filename.length === 0) {
				return null
			}
			const publicId = filename.split(".")[0]
			return publicId || null
		} catch {
			return null
		}
	}
}

export const cloudinaryUploadService = new CloudinaryUploadService()
