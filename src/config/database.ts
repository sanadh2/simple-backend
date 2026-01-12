import mongoose from "mongoose"

import { logger } from "../utils/logger.js"
import { env } from "./env.js"

export const connectDatabase = async (): Promise<void> => {
	try {
		await mongoose.connect(env.MONGO_URI)

		logger.info("✓ MongoDB connected successfully", undefined, true)

		mongoose.connection.on("error", (err) => {
			logger.error(`MongoDB connection error: ${String(err)}`)
		})

		mongoose.connection.on("disconnected", () => {
			logger.warn("MongoDB disconnected", undefined, true)
		})
	} catch (error) {
		logger.error(`Failed to connect to MongoDB: ${String(error)}`)
		process.exit(1)
	}
}

export const disconnectDatabase = async (): Promise<void> => {
	try {
		await mongoose.disconnect()
		logger.info("MongoDB disconnected successfully", undefined, true)
	} catch (error) {
		logger.error(`Error disconnecting from MongoDB: ${String(error)}`)
	}
}
