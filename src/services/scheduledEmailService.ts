import { ScheduledEmail } from "../models/index.js"

export interface UpcomingScheduledEmail {
	_id: string
	type: "follow_up" | "interview"
	scheduled_for: string
	meta: {
		company_name?: string
		job_title?: string
		contact_name?: string
		interview_type?: string
		interview_format?: string
	}
	job_application_id: string
}

export class ScheduledEmailService {
	static async getUpcoming(
		userId: string,
		limit: number = 10
	): Promise<UpcomingScheduledEmail[]> {
		const docs = await ScheduledEmail.find({
			user_id: userId,
			status: "pending",
		})
			.sort({ scheduled_for: 1 })
			.limit(limit)
			.lean()

		return docs.map((d) => ({
			_id: d._id.toString(),
			type: d.type,
			scheduled_for: d.scheduled_for.toISOString(),
			meta: d.meta || {},
			job_application_id: d.job_application_id.toString(),
		}))
	}
}
