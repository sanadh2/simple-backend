import { type Response } from "express"

interface SuccessResponse<T = undefined> {
	message: string
	data?: T
	meta?: {
		page?: number
		limit?: number
		total?: number
		totalPages?: number
	}
}

export class ResponseHandler {
	/**
	 * Send success response
	 */
	static success<T = undefined>(
		res: Response,
		statusCode: number = 200,
		payload: SuccessResponse<T>
	): void {
		const response: Record<string, unknown> = {
			success: true,
			message: payload.message,
		}

		if (payload.data !== undefined) {
			response.data = payload.data
		}

		if (payload.meta !== undefined) {
			response.meta = payload.meta
		}

		res.status(statusCode).json(response)
	}

	/**
	 * Send error response
	 */
	static error<E = undefined>(
		res: Response,
		statusCode: number = 500,
		message: string,
		errors?: E[]
	): void {
		const response: Record<string, unknown> = {
			success: false,
			message,
		}

		if (errors !== undefined) {
			response.errors = errors
		}

		res.status(statusCode).json(response)
	}

	/**
	 * Send paginated response
	 */
	static paginated<T>(
		res: Response,
		data: T[],
		page: number,
		limit: number,
		total: number,
		message: string = "Data retrieved successfully"
	): void {
		const totalPages = Math.ceil(total / limit)

		res.status(200).json({
			success: true,
			message,
			data,
			meta: {
				page,
				limit,
				total,
				totalPages,
			},
		})
	}

	/**
	 * Send created response
	 */
	static created<T>(res: Response, message: string, data?: T): void {
		if (data !== undefined) {
			this.success<T>(res, 201, { message, data })
		} else {
			this.success(res, 201, { message })
		}
	}

	/**
	 * Send no content response
	 */
	static noContent(res: Response): void {
		res.status(204).send()
	}
}
