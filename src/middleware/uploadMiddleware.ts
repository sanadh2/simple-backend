import multer from "multer"

import { AppError } from "./errorHandler.js"

const imageFileFilter = (
	_req: Express.Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
	if (allowedMimes.includes(file.mimetype)) {
		cb(null, true)
	} else {
		cb(
			new AppError(
				"Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
				400
			)
		)
	}
}

const documentFileFilter = (
	_req: Express.Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimes = [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"text/plain",
	]
	if (allowedMimes.includes(file.mimetype)) {
		cb(null, true)
	} else {
		cb(
			new AppError(
				"Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.",
				400
			)
		)
	}
}

export const uploadProfilePicture = multer({
	storage: multer.memoryStorage(),
	fileFilter: imageFileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
})

export const uploadDocument = multer({
	storage: multer.memoryStorage(),
	fileFilter: documentFileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
})
