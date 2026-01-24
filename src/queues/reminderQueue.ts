import { Queue } from "bullmq"

import { env } from "../config/env.js"

export interface ReminderJob {
	type: "process-due-reminders" | "process-interview-reminders"
}

const connection = {
	host: env.REDIS_HOST || "localhost",
	port: env.REDIS_PORT || 6379,
	...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
}

export const reminderQueue = new Queue<ReminderJob>("reminders", {
	connection,
	defaultJobOptions: {
		attempts: 2,
		backoff: {
			type: "exponential",
			delay: 5000,
		},
		removeOnComplete: {
			count: 100,
			age: 7 * 24 * 3600,
		},
		removeOnFail: {
			count: 50,
		},
	},
})

reminderQueue.on("error", (error) => {
	console.error("Reminder queue error:", error)
})
