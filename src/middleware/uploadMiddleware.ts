import multer from "multer"

import { AppError } from "./errorHandler.js"

const fileFilter = (
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

export const uploadProfilePicture = multer({
	storage: multer.memoryStorage(),
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
})
