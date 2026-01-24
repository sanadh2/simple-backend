import { Job, Worker } from "bullmq"

import { env } from "../config/env.js"
import { ApplicationContact, JobApplication, User } from "../models/index.js"
import type { ReminderJob } from "../queues/reminderQueue.js"
import { EmailService } from "../services/index.js"
import { logger } from "../utils/logger.js"

const connection = {
	host: env.REDIS_HOST || "localhost",
	port: env.REDIS_PORT || 6379,
	...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
}

function startOfTodayUTC(): Date {
	const d = new Date()
	d.setUTCHours(0, 0, 0, 0)
	return d
}

function startOfTomorrowUTC(): Date {
	const d = startOfTodayUTC()
	d.setUTCDate(d.getUTCDate() + 1)
	return d
}

function formatReminderDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	})
}

export const reminderWorker = new Worker<ReminderJob>(
	"reminders",
	async (job: Job<ReminderJob>) => {
		if (job.data?.type !== "process-due-reminders") {
			return
		}

		const start = startOfTodayUTC()
		const end = startOfTomorrowUTC()

		const contacts = await ApplicationContact.find({
			follow_up_reminder_at: { $gte: start, $lt: end },
			$or: [
				{ follow_up_reminder_sent_at: null },
				{ follow_up_reminder_sent_at: { $exists: false } },
			],
		}).lean()

		if (contacts.length === 0) {
			logger.info("No due follow-up reminders to process")
			return
		}

		logger.info("Processing follow-up reminders", { count: contacts.length })

		for (const contact of contacts) {
			try {
				const jobApp = await JobApplication.findById(
					contact.job_application_id
				).lean()

				if (!jobApp?.user_id) {
					logger.warn("Contact has missing or invalid job application", {
						contactId: contact._id,
					})
					continue
				}

				const user = await User.findById(jobApp.user_id)
					.select("email first_name")
					.lean()

				if (!user?.email) {
					logger.warn("User not found or has no email", {
						userId: jobApp.user_id,
					})
					continue
				}

				await EmailService.sendFollowUpReminder(user.email, user.first_name, {
					contactName: contact.name,
					companyName: jobApp.company_name,
					jobTitle: jobApp.job_title,
					reminderDate: formatReminderDate(
						contact.follow_up_reminder_at as Date
					),
				})

				await ApplicationContact.findByIdAndUpdate(contact._id, {
					$set: { follow_up_reminder_sent_at: new Date() },
				})

				logger.info("Follow-up reminder email sent", {
					contactId: contact._id,
					userId: user._id,
				})
			} catch (error) {
				logger.error("Failed to send follow-up reminder", {
					contactId: contact._id,
					error: error instanceof Error ? error.message : String(error),
				})
				// Continue with other contacts; do not rethrow so the job is marked complete
			}
		}
	},
	{
		connection,
		concurrency: 1,
	}
)

reminderWorker.on("failed", (job, error) => {
	logger.error("Reminder job failed", {
		jobId: job?.id,
		error: error.message,
	})
})

reminderWorker.on("error", (error) => {
	logger.error("Reminder worker error", { error: error.message })
})

export const startReminderWorker = () => {
	logger.info("✓ Reminder worker started", undefined, true)
}

export const stopReminderWorker = async () => {
	await reminderWorker.close()
	logger.info("✓ Reminder worker stopped", undefined, true)
}
