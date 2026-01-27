import { Job, Worker } from "bullmq"
import { DateTime } from "luxon"

import { env } from "../config/env.js"
import {
	ApplicationContact,
	Interview,
	JobApplication,
	ScheduledEmail,
	User,
} from "../models/index.js"
import type { ReminderJob } from "../queues/reminderQueue.js"
import { EmailService } from "../services/index.js"
import { logger } from "../utils/logger.js"

const connection = {
	host: env.REDIS_HOST || "localhost",
	port: env.REDIS_PORT || 6379,
	...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
}

function getUserTz(user: { timezone?: string | null }): string {
	return user?.timezone && user.timezone.trim() ? user.timezone.trim() : "UTC"
}

function isReminderTimeNow(
	user: { reminder_time?: string | null },
	nowInUserTz: DateTime
): boolean {
	const rt = user?.reminder_time?.trim()
	if (!rt) return true
	const m = rt.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
	if (!m || m[1] === undefined || m[1] === null) return true
	const hour = parseInt(m[1], 10)
	return nowInUserTz.hour === hour
}

function formatReminderDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	})
}

function formatScheduledAt(date: Date, timeZone?: string): string {
	return date.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
		...(timeZone && { timeZone }),
	})
}

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
	phone_screen: "Phone Screen",
	technical: "Technical",
	behavioral: "Behavioral",
	system_design: "System Design",
	hr: "HR",
	final: "Final",
}

const INTERVIEW_FORMAT_LABELS: Record<string, string> = {
	phone: "Phone",
	video: "Video",
	in_person: "In Person",
}

export const reminderWorker = new Worker<ReminderJob>(
	"reminders",
	async (job: Job<ReminderJob>) => {
		if (job.data?.type === "process-due-reminders") {
			const now = new Date()
			const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
			const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

			const contacts = await ApplicationContact.find({
				follow_up_reminder_at: { $gte: windowStart, $lte: windowEnd },
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
						.select("email first_name timezone reminder_time")
						.lean()

					if (!user?.email) {
						logger.warn("User not found or has no email", {
							userId: jobApp.user_id,
						})
						continue
					}

					const tz = getUserTz(user)
					const nowInUserTz = DateTime.now().setZone(tz)
					const todayUser = nowInUserTz.toISODate()
					const reminderDateUser = DateTime.fromJSDate(
						contact.follow_up_reminder_at as Date
					)
						.setZone(tz)
						.toISODate()

					if (reminderDateUser !== todayUser) continue
					if (!isReminderTimeNow(user, nowInUserTz)) continue

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
					await ScheduledEmail.updateOne(
						{
							parent_type: "ApplicationContact",
							parent_id: contact._id,
						},
						{ $set: { status: "sent", sent_at: new Date() } }
					)

					logger.info("Follow-up reminder email sent", {
						contactId: contact._id,
						userId: user._id,
					})
				} catch (error) {
					await ScheduledEmail.updateOne(
						{
							parent_type: "ApplicationContact",
							parent_id: contact._id,
						},
						{
							$set: {
								status: "failed",
								failure_message:
									error instanceof Error ? error.message : String(error),
							},
						}
					)
					logger.error("Failed to send follow-up reminder", {
						contactId: contact._id,
						error: error instanceof Error ? error.message : String(error),
					})
					// Continue with other contacts; do not rethrow so the job is marked complete
				}
			}
		} else if (job.data?.type === "process-interview-reminders") {
			const now = new Date()
			const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

			const interviews = await Interview.find({
				scheduled_at: { $gte: now, $lte: windowEnd },
				$or: [
					{ interview_reminder_sent_at: null },
					{ interview_reminder_sent_at: { $exists: false } },
				],
			}).lean()

			if (interviews.length === 0) {
				logger.info("No interview reminders to process")
				return
			}

			logger.info("Processing interview reminders", {
				count: interviews.length,
			})

			for (const interview of interviews) {
				try {
					const jobApp = await JobApplication.findById(
						interview.job_application_id
					).lean()

					if (!jobApp?.user_id) {
						logger.warn("Interview has missing or invalid job application", {
							interviewId: interview._id,
						})
						continue
					}

					const user = await User.findById(jobApp.user_id)
						.select("email first_name timezone reminder_time")
						.lean()

					if (!user?.email) {
						logger.warn("User not found or has no email", {
							userId: jobApp.user_id,
						})
						continue
					}

					const tz = getUserTz(user)
					const nowInUserTz = DateTime.now().setZone(tz)
					const tomorrowUser = nowInUserTz.plus({ days: 1 }).toISODate()
					const scheduledDateUser = DateTime.fromJSDate(interview.scheduled_at)
						.setZone(tz)
						.toISODate()

					if (scheduledDateUser !== tomorrowUser) continue
					if (!isReminderTimeNow(user, nowInUserTz)) continue

					const interviewType =
						INTERVIEW_TYPE_LABELS[interview.interview_type] ??
						interview.interview_type
					const interviewFormat =
						INTERVIEW_FORMAT_LABELS[interview.interview_format] ??
						interview.interview_format

					await EmailService.sendInterviewReminder(
						user.email,
						user.first_name,
						{
							companyName: jobApp.company_name,
							jobTitle: jobApp.job_title,
							interviewType,
							interviewFormat,
							scheduledAt: formatScheduledAt(interview.scheduled_at, tz),
						}
					)

					await Interview.findByIdAndUpdate(interview._id, {
						$set: { interview_reminder_sent_at: new Date() },
					})
					await ScheduledEmail.updateOne(
						{
							parent_type: "Interview",
							parent_id: interview._id,
						},
						{ $set: { status: "sent", sent_at: new Date() } }
					)

					logger.info("Interview reminder email sent", {
						interviewId: interview._id,
						userId: user._id,
					})
				} catch (error) {
					await ScheduledEmail.updateOne(
						{
							parent_type: "Interview",
							parent_id: interview._id,
						},
						{
							$set: {
								status: "failed",
								failure_message:
									error instanceof Error ? error.message : String(error),
							},
						}
					)
					logger.error("Failed to send interview reminder", {
						interviewId: interview._id,
						error: error instanceof Error ? error.message : String(error),
					})
					// Continue with other interviews; do not rethrow so the job is marked complete
				}
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
