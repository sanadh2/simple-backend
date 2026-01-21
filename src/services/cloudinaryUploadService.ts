/**
 * Cloudinary File Upload Service Implementation
 *
 * This file contains ALL Cloudinary-specific logic.
 * To switch to AWS S3 or another provider, only this file needs to change.
 */

import { v2 as cloudinary } from "cloudinary"

import { env } from "../config/env.js"
import { logger } from "../utils/logger.js"
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
		userId: string,
		resourceType: "image" | "raw" = "image"
	): Promise<UploadResult> {
		logger.debug("Starting file upload to Cloudinary", {
			filename,
			folder,
			userId,
			resourceType,
			bufferSize: buffer.length,
		})

		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`

		const fileExtension = filename.toLowerCase().split(".").pop() || ""

		const publicId =
			resourceType === "raw"
				? `${folder}/${userId}-${uniqueSuffix}.${fileExtension}`
				: `${folder}/${userId}-${uniqueSuffix}`

		logger.debug("Generated public ID for upload", { publicId })

		const uploadOptions: Record<string, unknown> = {
			public_id: publicId,
			folder: folder,
			resource_type: resourceType,
			use_filename: false,
			unique_filename: false,
		}

		if (resourceType === "image") {
			uploadOptions.allowed_formats = ["jpg", "jpeg", "png", "webp"]
			uploadOptions.transformation = [
				{
					width: 800,
					height: 800,
					crop: "limit",
					quality: "auto",
					fetch_format: "auto",
				},
			]
		} else if (resourceType === "raw") {
			uploadOptions.allowed_formats = ["pdf", "doc", "docx", "txt"]
		}

		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				uploadOptions,
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

						logger.error(
							"Cloudinary upload failed",
							error instanceof Error ? error : new Error(errorMessage),
							{
								filename,
								folder,
								userId,
								resourceType,
								publicId,
								errorDetails,
							}
						)

						reject(new Error(`Cloudinary upload failed: ${errorMessage}`))
						return
					}

					if (!result) {
						const error = new Error("Cloudinary upload returned no result")
						logger.error("Cloudinary upload returned no result", error, {
							filename,
							folder,
							userId,
							resourceType,
							publicId,
						})
						reject(error)
						return
					}

					logger.info("File uploaded successfully to Cloudinary", {
						filename,
						folder,
						userId,
						resourceType,
						publicId: result.public_id,
						url: result.secure_url,
					})

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
	async deleteFile(
		urlOrPublicId: string,
		resourceType: "image" | "raw" = "image"
	): Promise<void> {
		try {
			logger.debug("Starting file deletion from Cloudinary", {
				urlOrPublicId,
				resourceType,
			})

			const publicId = this.extractPublicId(urlOrPublicId) || urlOrPublicId

			logger.debug("Extracted public ID for deletion", {
				publicId,
				urlOrPublicId,
			})

			await cloudinary.uploader.destroy(publicId, {
				resource_type: resourceType,
				invalidate: true,
			})

			logger.info("File deleted successfully from Cloudinary", {
				publicId,
				resourceType,
			})
		} catch (error) {
			logger.error(
				"Failed to delete file from Cloudinary",
				error instanceof Error ? error : new Error(String(error)),
				{
					urlOrPublicId,
					resourceType,
				}
			)
			throw error
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
			logger.debug(
				"URL is not a Cloudinary URL, skipping public ID extraction",
				{
					url,
				}
			)
			return null
		}

		try {
			logger.debug("Extracting public ID from Cloudinary URL", { url })

			const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/)
			if (match && match[1]) {
				logger.debug("Successfully extracted public ID using regex", {
					publicId: match[1],
					url,
				})
				return match[1]
			}

			const urlParts = url.split("/")
			const filename = urlParts[urlParts.length - 1]
			if (!filename || filename.length === 0) {
				logger.debug("Could not extract filename from URL", { url })
				return null
			}

			logger.debug("Successfully extracted public ID using fallback method", {
				publicId: filename,
				url,
			})
			return filename || null
		} catch (error) {
			logger.error(
				"Error extracting public ID from Cloudinary URL",
				error instanceof Error ? error : new Error(String(error)),
				{ url }
			)
			return null
		}
	}
}

export const cloudinaryUploadService = new CloudinaryUploadService()
