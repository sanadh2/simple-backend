import { randomUUID } from "crypto"
import type { NextFunction, Request, Response } from "express"

import { Logger } from "../utils/logger.js"

declare module "express-serve-static-core" {
	interface Request {
		correlation_id?: string
	}
}

export const correlation_idMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const correlation_id =
		(req.headers["x-correlation-id"] as string) || randomUUID()

	req.correlation_id = correlation_id
	res.setHeader("X-Correlation-ID", correlation_id)

	Logger.runWithContext({ correlation_id }, () => {
		next()
	})
}
