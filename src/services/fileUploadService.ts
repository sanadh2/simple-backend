/**
 * File Upload Service Interface
 *
 * This interface abstracts file upload functionality to allow switching
 * between different providers (Cloudinary, AWS S3, etc.) without changing
 * the rest of the application.
 *
 * To switch providers, only the implementation file needs to change.
 */

export interface UploadResult {
	url: string
	publicId?: string // Provider-specific identifier for the uploaded file
}

export interface FileUploadService {
	/**
	 * Upload a file buffer to the storage provider
	 * @param buffer - File buffer to upload
	 * @param filename - Original filename (for extension detection)
	 * @param folder - Folder/path where the file should be stored
	 * @param userId - User ID for generating unique file names
	 * @returns Promise resolving to the upload result with URL
	 */
	uploadFile(
		buffer: Buffer,
		filename: string,
		folder: string,
		userId: string
	): Promise<UploadResult>

	/**
	 * Delete a file from the storage provider
	 * @param urlOrPublicId - URL or public ID of the file to delete
	 * @returns Promise resolving when deletion is complete
	 */
	deleteFile(urlOrPublicId: string): Promise<void>

	/**
	 * Check if a URL belongs to this provider
	 * @param url - URL to check
	 * @returns true if the URL is from this provider
	 */
	isProviderUrl(url: string): boolean

	/**
	 * Extract the public ID from a provider URL
	 * @param url - Provider URL
	 * @returns Public ID or null if not found
	 */
	extractPublicId(url: string): string | null
}
