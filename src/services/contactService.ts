import mongoose from "mongoose"
import { z } from "zod"

import {
	ApplicationContact,
	Interaction,
	JobApplication,
	ScheduledEmail,
} from "../models/index.js"
import { logger } from "../utils/logger.js"

export const createContactSchema = z.object({
	job_application_id: z.string().min(1, "Job application ID is required"),
	name: z.string().min(1, "Name is required"),
	role: z.string().optional(),
	email: z.email("Invalid email").optional().or(z.literal("")),
	phone: z.string().optional(),
	linkedin_url: z.url("Invalid URL").optional().or(z.literal("")),
	last_contacted_at: z.coerce.date().optional(),
	follow_up_reminder_at: z.coerce.date().optional(),
})

export const updateContactSchema = createContactSchema.partial().extend({
	job_application_id: z.string().optional(),
})

export const addInteractionSchema = z.object({
	date: z.coerce.date().optional(),
	type: z.string().optional(),
	notes: z.string().optional(),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type AddInteractionInput = z.infer<typeof addInteractionSchema>

export interface IApplicationContact {
	_id: mongoose.Types.ObjectId
	job_application_id: mongoose.Types.ObjectId
	name: string
	role?: string
	email?: string
	phone?: string
	linkedin_url?: string
	last_contacted_at?: Date
	follow_up_reminder_at?: Date
	interaction_history: Array<{ date: Date; type?: string; notes?: string }>
	createdAt: Date
	updatedAt: Date
}

export class ContactService {
	static async create(
		userId: string,
		data: CreateContactInput
	): Promise<IApplicationContact> {
		const jobApplication = await JobApplication.findOne({
			_id: data.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Job application not found or access denied")
		}

		const contactData: Record<string, unknown> = {
			job_application_id: new mongoose.Types.ObjectId(data.job_application_id),
			name: data.name,
		}

		if (data.role !== undefined) contactData.role = data.role
		if (data.email) contactData.email = data.email
		if (data.phone !== undefined) contactData.phone = data.phone
		if (data.linkedin_url) contactData.linkedin_url = data.linkedin_url
		if (data.last_contacted_at)
			contactData.last_contacted_at = data.last_contacted_at
		if (data.follow_up_reminder_at)
			contactData.follow_up_reminder_at = data.follow_up_reminder_at

		const contact = await ApplicationContact.create(
			contactData as Parameters<typeof ApplicationContact.create>[0]
		)

		if (data.follow_up_reminder_at) {
			await ScheduledEmail.create({
				type: "follow_up",
				parent_type: "ApplicationContact",
				parent_id: contact._id,
				job_application_id: new mongoose.Types.ObjectId(
					data.job_application_id
				),
				user_id: jobApplication.user_id,
				scheduled_for: data.follow_up_reminder_at,
				status: "pending",
				meta: {
					company_name: jobApplication.company_name,
					job_title: jobApplication.job_title,
					contact_name: data.name,
				},
			})
		}

		logger.info("Application contact created", {
			contactId: contact._id.toString(),
			jobApplicationId: data.job_application_id,
			userId,
		})

		return {
			...contact.toObject(),
			interaction_history: [],
		} as IApplicationContact
	}

	static async getById(
		contactId: string,
		userId: string
	): Promise<IApplicationContact | null> {
		const contact = await ApplicationContact.findById(contactId)
		if (!contact) return null

		const jobApplication = await JobApplication.findOne({
			_id: contact.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Contact not found or access denied")
		}

		const interactions = await Interaction.find({
			application_contact_id: contactId,
		})
			.sort({ date: -1 })
			.lean()
		const interaction_history = interactions.map((i) => ({
			date: i.date,
			...(i.type !== null && i.type !== undefined && { type: i.type }),
			...(i.notes !== null && i.notes !== undefined && { notes: i.notes }),
		}))
		return { ...contact.toObject(), interaction_history } as IApplicationContact
	}

	static async getByJobApplicationId(
		jobApplicationId: string,
		userId: string
	): Promise<IApplicationContact[]> {
		const jobApplication = await JobApplication.findOne({
			_id: jobApplicationId,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Job application not found or access denied")
		}

		const contacts = await ApplicationContact.find({
			job_application_id: jobApplicationId,
		})
			.sort({ name: 1 })
			.lean()

		const contactIds = contacts.map((c) => c._id)
		const interactions =
			contactIds.length > 0
				? await Interaction.find({
						application_contact_id: { $in: contactIds },
					})
						.sort({ date: -1 })
						.lean()
				: []
		const byContact = new Map<
			string,
			Array<{ date: Date; type?: string; notes?: string }>
		>()
		for (const i of interactions) {
			const k = i.application_contact_id.toString()
			let arr = byContact.get(k)
			if (!arr) {
				arr = []
				byContact.set(k, arr)
			}
			arr.push({
				date: i.date,
				...(i.type !== null && i.type !== undefined && { type: i.type }),
				...(i.notes !== null && i.notes !== undefined && { notes: i.notes }),
			})
		}
		return contacts.map((c) => ({
			...c,
			interaction_history: byContact.get(c._id.toString()) ?? [],
		})) as IApplicationContact[]
	}

	static async update(
		contactId: string,
		userId: string,
		data: UpdateContactInput
	): Promise<IApplicationContact | null> {
		const contact = await ApplicationContact.findById(contactId)
		if (!contact) return null

		const jobApplication = await JobApplication.findOne({
			_id: contact.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Contact not found or access denied")
		}

		const updateData: Record<string, unknown> = {}
		if (data.name !== undefined) updateData.name = data.name
		if (data.role !== undefined) updateData.role = data.role
		if (data.email !== undefined) updateData.email = data.email
		if (data.phone !== undefined) updateData.phone = data.phone
		if (data.linkedin_url !== undefined)
			updateData.linkedin_url = data.linkedin_url
		if (data.last_contacted_at !== undefined)
			updateData.last_contacted_at = data.last_contacted_at
		if (data.follow_up_reminder_at !== undefined) {
			updateData.follow_up_reminder_at = data.follow_up_reminder_at
			updateData.follow_up_reminder_sent_at = null
		}
		if (data.job_application_id !== undefined) {
			const newJobApp = await JobApplication.findOne({
				_id: data.job_application_id,
				user_id: userId,
			})
			if (!newJobApp)
				throw new Error("Job application not found or access denied")
			updateData.job_application_id = new mongoose.Types.ObjectId(
				data.job_application_id
			)
		}

		const updated = await ApplicationContact.findByIdAndUpdate(
			contactId,
			updateData,
			{ new: true, runValidators: true }
		)

		if (!updated) return null

		if (updated.follow_up_reminder_at) {
			const jobApp = await JobApplication.findById(updated.job_application_id)
				.select("user_id company_name job_title")
				.lean()
			if (jobApp) {
				await ScheduledEmail.findOneAndUpdate(
					{ parent_type: "ApplicationContact", parent_id: updated._id },
					{
						$set: {
							type: "follow_up",
							job_application_id: updated.job_application_id,
							user_id: jobApp.user_id,
							scheduled_for: updated.follow_up_reminder_at,
							status: "pending",
							meta: {
								company_name: jobApp.company_name,
								job_title: jobApp.job_title,
								contact_name: updated.name,
							},
						},
						$unset: { sent_at: "", failure_message: "" },
					},
					{ upsert: true }
				)
			}
		} else {
			await ScheduledEmail.deleteMany({
				parent_type: "ApplicationContact",
				parent_id: updated._id,
			})
		}

		const interactions = await Interaction.find({
			application_contact_id: contactId,
		})
			.sort({ date: -1 })
			.lean()
		const interaction_history = interactions.map((i) => ({
			date: i.date,
			...(i.type !== null && i.type !== undefined && { type: i.type }),
			...(i.notes !== null && i.notes !== undefined && { notes: i.notes }),
		}))
		logger.info("Application contact updated", { contactId, userId })
		return { ...updated.toObject(), interaction_history } as IApplicationContact
	}

	static async delete(contactId: string, userId: string): Promise<boolean> {
		const contact = await ApplicationContact.findById(contactId)
		if (!contact) return false

		const jobApplication = await JobApplication.findOne({
			_id: contact.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Contact not found or access denied")
		}

		await ApplicationContact.findByIdAndDelete(contactId)
		logger.info("Application contact deleted", { contactId, userId })
		return true
	}

	static async addInteraction(
		contactId: string,
		userId: string,
		data: AddInteractionInput
	): Promise<IApplicationContact | null> {
		const contact = await ApplicationContact.findById(contactId)
		if (!contact) return null

		const jobApplication = await JobApplication.findOne({
			_id: contact.job_application_id,
			user_id: userId,
		})

		if (!jobApplication) {
			throw new Error("Contact not found or access denied")
		}

		const interactionDate = data.date ?? new Date()
		await Interaction.create({
			application_contact_id: contactId,
			date: interactionDate,
			...(data.type !== null && data.type !== undefined && { type: data.type }),
			...(data.notes !== null &&
				data.notes !== undefined && { notes: data.notes }),
		})

		const updated = await ApplicationContact.findByIdAndUpdate(
			contactId,
			{ $set: { last_contacted_at: interactionDate } },
			{ new: true, runValidators: true }
		)

		if (!updated) return null

		const interactions = await Interaction.find({
			application_contact_id: contactId,
		})
			.sort({ date: -1 })
			.lean()
		const interaction_history = interactions.map((i) => ({
			date: i.date,
			...(i.type !== null && i.type !== undefined && { type: i.type }),
			...(i.notes !== null && i.notes !== undefined && { notes: i.notes }),
		}))
		logger.info("Interaction added to contact", { contactId, userId })
		return { ...updated.toObject(), interaction_history } as IApplicationContact
	}
}
