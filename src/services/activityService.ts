import {
	ApplicationContact,
	Interview,
	JobApplication,
	StatusHistory,
} from "../models/index.js"

export type ActivityType =
	| "application_submitted"
	| "status_change"
	| "interview_completed"
	| "follow_up_sent"

export interface TimelineActivity {
	type: ActivityType
	date: string
	description: string
	job_application_id: string
	company_name: string
	job_title: string
	meta?: {
		status?: string
		interview_type?: string
		contact_name?: string
	}
}

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
	phone_screen: "Phone Screen",
	technical: "Technical",
	behavioral: "Behavioral",
	system_design: "System Design",
	hr: "HR",
	final: "Final",
}

export class ActivityService {
	static async getTimeline(
		userId: string,
		startDate?: Date,
		endDate?: Date
	): Promise<TimelineActivity[]> {
		const activities: TimelineActivity[] = []

		// Get user's job application IDs for joins
		const userApps = await JobApplication.find({ user_id: userId })
			.select("_id company_name job_title")
			.lean()
		const appIds = userApps.map((a) => a._id)
		const appMap = new Map(
			userApps.map((a) => [a._id.toString(), { company_name: a.company_name, job_title: a.job_title }])
		)

		if (appIds.length === 0) {
			return []
		}

		const dateFilter: Record<string, Date> = {}
		if (startDate) dateFilter.$gte = startDate
		if (endDate) dateFilter.$lte = endDate
		const hasDateFilter = Object.keys(dateFilter).length > 0

		// 1. Applications submitted (application_date)
		const appDateQuery: Record<string, unknown> = {
			user_id: userId,
		}
		if (hasDateFilter) {
			appDateQuery.application_date = dateFilter
		}
		const applications = await JobApplication.find(appDateQuery)
			.select("_id company_name job_title application_date")
			.lean()

		for (const app of applications) {
			activities.push({
				type: "application_submitted",
				date: new Date(app.application_date).toISOString(),
				description: `Applied to ${app.company_name} – ${app.job_title}`,
				job_application_id: app._id.toString(),
				company_name: app.company_name,
				job_title: app.job_title,
			})
		}

		// 2. Status changes (StatusHistory.changed_at)
		const statusQuery: Record<string, unknown> = {
			job_application_id: { $in: appIds },
		}
		if (hasDateFilter) {
			statusQuery.changed_at = dateFilter
		}
		const statusEntries = await StatusHistory.find(statusQuery)
			.sort({ changed_at: 1 })
			.lean()

		for (const entry of statusEntries) {
			const app = appMap.get(entry.job_application_id.toString())
			if (!app) continue
			activities.push({
				type: "status_change",
				date: new Date(entry.changed_at).toISOString(),
				description: `Status changed to ${entry.status} for ${app.company_name}`,
				job_application_id: entry.job_application_id.toString(),
				company_name: app.company_name,
				job_title: app.job_title,
				meta: { status: entry.status },
			})
		}

		// 3. Interviews completed (Interview with feedback, scheduled_at as date)
		const interviewQuery: Record<string, unknown> = {
			job_application_id: { $in: appIds },
			feedback: { $exists: true, $nin: [null, ""] },
		}
		if (hasDateFilter) {
			interviewQuery.scheduled_at = dateFilter
		}
		const interviews = await Interview.find(interviewQuery)
			.select("job_application_id scheduled_at interview_type")
			.lean()

		for (const inv of interviews) {
			const app = appMap.get(inv.job_application_id.toString())
			if (!app) continue
			const typeLabel =
				INTERVIEW_TYPE_LABELS[inv.interview_type] || inv.interview_type
			activities.push({
				type: "interview_completed",
				date: new Date(inv.scheduled_at).toISOString(),
				description: `Completed ${typeLabel} interview at ${app.company_name}`,
				job_application_id: inv.job_application_id.toString(),
				company_name: app.company_name,
				job_title: app.job_title,
				meta: { interview_type: inv.interview_type },
			})
		}

		// 4. Follow-ups sent (ApplicationContact.follow_up_reminder_sent_at)
		const followUpSentFilter: Record<string, unknown> = {
			$exists: true,
			$ne: null,
		}
		if (hasDateFilter) {
			Object.assign(followUpSentFilter, dateFilter)
		}
		const followUpQuery: Record<string, unknown> = {
			job_application_id: { $in: appIds },
			follow_up_reminder_sent_at: followUpSentFilter,
		}
		const contacts = await ApplicationContact.find(followUpQuery)
			.select("job_application_id name follow_up_reminder_sent_at")
			.lean()

		for (const c of contacts) {
			const app = appMap.get(c.job_application_id.toString())
			if (!app) continue
			const sentAt = c.follow_up_reminder_sent_at as Date
			activities.push({
				type: "follow_up_sent",
				date: new Date(sentAt).toISOString(),
				description: `Follow-up reminder sent for ${app.company_name} (${c.name})`,
				job_application_id: c.job_application_id.toString(),
				company_name: app.company_name,
				job_title: app.job_title,
				meta: { contact_name: c.name },
			})
		}

		// Sort by date descending (most recent first)
		activities.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		)

		return activities
	}
}
