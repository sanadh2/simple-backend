import mongoose from "mongoose"
import { z } from "zod"

import {
	Interview,
	InterviewChecklistItem,
	JobApplication,
} from "../models/index.js"
import { logger } from "../utils/logger.js"

export const createInterviewSchema = z.object({
	job_application_id: z.string().min(1, "Job application ID is required"),
	interview_type: z.enum([
		"phone_screen",
		"technical",
		"behavioral",
		"system_design",
		"hr",
		"final",
	]),
	scheduled_at: z.coerce.date(),
	interviewer_name: z.string().optional(),
	interviewer_role: z.string().optional(),
	interview_format: z.enum(["phone", "video", "in_person"]),
	duration_minutes: z.number().min(1).optional(),
	notes: z.string().optional(),
	feedback: z.string().optional(),
	preparation_checklist: z.array(z.string()).optional(),
})

export const updateInterviewSchema = createInterviewSchema.partial().extend({
	job_application_id: z.string().optional(),
})

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>

export interface IInterview {
	_id: mongoose.Types.ObjectId
	job_application_id: mongoose.Types.ObjectId
	interview_type: string
	scheduled_at: Date
	interviewer_name?: string
	interviewer_role?: string
	interview_format: string
	duration_minutes?: number
	notes?: string
	feedback?: string
	preparation_checklist?: string[]
	createdAt: Date
	updatedAt: Date
}

export class InterviewService {
	static async create(
		userId: string,
		data: CreateInterviewInput
	): Promise<IInterview> {
		// Verify the job application belongs to the user
		const jobApplication = await JobApplication.findOne({
			_id: data.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Job application not found or access denied")
		}

		const interviewData: Record<string, unknown> = {
			job_application_id: new mongoose.Types.ObjectId(data.job_application_id),
			interview_type: data.interview_type,
			scheduled_at: data.scheduled_at,
			interview_format: data.interview_format,
		}
		if (data.interviewer_name !== undefined)
			interviewData.interviewer_name = data.interviewer_name
		if (data.interviewer_role !== undefined)
			interviewData.interviewer_role = data.interviewer_role
		if (data.duration_minutes !== undefined)
			interviewData.duration_minutes = data.duration_minutes
		if (data.notes !== undefined) interviewData.notes = data.notes
		if (data.feedback !== undefined) interviewData.feedback = data.feedback

		const interview = await Interview.create(
			interviewData as unknown as Parameters<typeof Interview.create>[0]
		)

		const items = data.preparation_checklist || []
		if (items.length > 0) {
			await InterviewChecklistItem.insertMany(
				items.map((item) => ({ interview_id: interview._id, item }))
			)
		}

		logger.info("Interview created", {
			interviewId: interview._id.toString(),
			jobApplicationId: data.job_application_id,
			userId,
		})

		return { ...interview.toObject(), preparation_checklist: items } as IInterview
	}

	static async getById(
		interviewId: string,
		userId: string
	): Promise<IInterview | null> {
		const interview = await Interview.findById(interviewId)

		if (!interview) {
			return null
		}

		// Verify the job application belongs to the user
		const jobApplication = await JobApplication.findOne({
			_id: interview.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Interview not found or access denied")
		}

		const items = await InterviewChecklistItem.find({
			interview_id: interviewId,
		})
			.sort({ createdAt: 1 })
			.lean()
		const preparation_checklist = items.map((i) => i.item)
		return { ...interview.toObject(), preparation_checklist } as IInterview
	}

	static async getByJobApplicationId(
		jobApplicationId: string,
		userId: string
	): Promise<IInterview[]> {
		// Verify the job application belongs to the user
		const jobApplication = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Job application not found or access denied")
		}

		const interviews = await Interview.find({
			job_application_id: jobApplicationId,
		})
			.sort({ scheduled_at: 1 })
			.lean()

		const interviewIds = interviews.map((i) => i._id)
		const allItems =
			interviewIds.length > 0
				? await InterviewChecklistItem.find({
						interview_id: { $in: interviewIds },
					})
						.sort({ interview_id: 1, createdAt: 1 })
						.lean()
				: []
		const byInterview = new Map<string, string[]>()
		for (const it of allItems) {
			const k = it.interview_id.toString()
			if (!byInterview.has(k)) byInterview.set(k, [])
			byInterview.get(k)!.push(it.item)
		}
		return interviews.map((inv) => ({
			...inv,
			preparation_checklist: byInterview.get(inv._id.toString()) ?? [],
		})) as IInterview[]
	}

	static async getAll(userId: string): Promise<IInterview[]> {
		// Get all job applications for the user
		const jobApplications = await JobApplication.find({
			user_id: userId,
		}).select("_id")

		const jobApplicationIds = jobApplications.map((app) => app._id)

		const interviews = await Interview.find({
			job_application_id: { $in: jobApplicationIds },
		})
			.sort({ scheduled_at: -1 })
			.lean()

		const interviewIds = interviews.map((i) => i._id)
		const allItems =
			interviewIds.length > 0
				? await InterviewChecklistItem.find({
						interview_id: { $in: interviewIds },
					})
						.sort({ interview_id: 1, createdAt: 1 })
						.lean()
				: []
		const byInterview = new Map<string, string[]>()
		for (const it of allItems) {
			const k = it.interview_id.toString()
			if (!byInterview.has(k)) byInterview.set(k, [])
			byInterview.get(k)!.push(it.item)
		}
		return interviews.map((inv) => ({
			...inv,
			preparation_checklist: byInterview.get(inv._id.toString()) ?? [],
		})) as IInterview[]
	}

	static async update(
		interviewId: string,
		userId: string,
		data: UpdateInterviewInput
	): Promise<IInterview | null> {
		const interview = await Interview.findById(interviewId)

		if (!interview) {
			return null
		}

		// Verify the job application belongs to the user
		const jobApplication = await JobApplication.findOne({
			_id: interview.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Interview not found or access denied")
		}

		// If job_application_id is being updated, verify the new one belongs to the user
		if (data.job_application_id) {
			const newJobApplication = await JobApplication.findOne({
				_id: data.job_application_id,
				user_id: userId,
			})

			if (!newJobApplication) {
				throw new Error("Job application not found or access denied")
			}
		}

		const updateData: Record<string, unknown> = {}
		if (data.interview_type !== undefined)
			updateData.interview_type = data.interview_type
		if (data.scheduled_at !== undefined)
			updateData.scheduled_at = data.scheduled_at
		if (data.interviewer_name !== undefined)
			updateData.interviewer_name = data.interviewer_name
		if (data.interviewer_role !== undefined)
			updateData.interviewer_role = data.interviewer_role
		if (data.interview_format !== undefined)
			updateData.interview_format = data.interview_format
		if (data.duration_minutes !== undefined)
			updateData.duration_minutes = data.duration_minutes
		if (data.notes !== undefined) updateData.notes = data.notes
		if (data.feedback !== undefined) updateData.feedback = data.feedback
		if (data.job_application_id !== undefined)
			updateData.job_application_id = new mongoose.Types.ObjectId(
				data.job_application_id
			)

		if (data.preparation_checklist !== undefined) {
			await InterviewChecklistItem.deleteMany({ interview_id: interviewId })
			if (data.preparation_checklist.length > 0) {
				await InterviewChecklistItem.insertMany(
					data.preparation_checklist.map((item) => ({
						interview_id: interviewId,
						item,
					}))
				)
			}
		}

		const updatedInterview = await Interview.findByIdAndUpdate(
			interviewId,
			updateData,
			{ new: true, runValidators: true }
		)

		if (!updatedInterview) {
			return null
		}

		const items = await InterviewChecklistItem.find({
			interview_id: interviewId,
		})
			.sort({ createdAt: 1 })
			.lean()
		const preparation_checklist = items.map((i) => i.item)

		logger.info("Interview updated", { interviewId, userId })
		return { ...updatedInterview.toObject(), preparation_checklist } as IInterview
	}

	static async delete(interviewId: string, userId: string): Promise<boolean> {
		const interview = await Interview.findById(interviewId)

		if (!interview) {
			return false
		}

		// Verify the job application belongs to the user
		const jobApplication = await JobApplication.findOne({
			_id: interview.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Interview not found or access denied")
		}

		await Interview.findByIdAndDelete(interviewId)

		logger.info("Interview deleted", {
			interviewId,
			userId,
		})

		return true
	}

	static async getUpcomingInterviews(
		userId: string,
		days: number = 30
	): Promise<IInterview[]> {
		const jobApplications = await JobApplication.find({
			user_id: userId,
		}).select("_id")

		const jobApplicationIds = jobApplications.map((app) => app._id)

		const now = new Date()
		const futureDate = new Date()
		futureDate.setDate(futureDate.getDate() + days)

		const interviews = await Interview.find({
			job_application_id: { $in: jobApplicationIds },
			scheduled_at: {
				$gte: now,
				$lte: futureDate,
			},
		})
			.sort({ scheduled_at: 1 })
			.lean()

		const interviewIds = interviews.map((i) => i._id)
		const allItems =
			interviewIds.length > 0
				? await InterviewChecklistItem.find({
						interview_id: { $in: interviewIds },
					})
						.sort({ interview_id: 1, createdAt: 1 })
						.lean()
				: []
		const byInterview = new Map<string, string[]>()
		for (const it of allItems) {
			const k = it.interview_id.toString()
			if (!byInterview.has(k)) byInterview.set(k, [])
			byInterview.get(k)!.push(it.item)
		}
		return interviews.map((inv) => ({
			...inv,
			preparation_checklist: byInterview.get(inv._id.toString()) ?? [],
		})) as IInterview[]
	}
}
