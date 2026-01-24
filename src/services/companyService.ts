import mongoose from "mongoose"
import { z } from "zod"

import { Company, CompanyAttribute, JobApplication } from "../models/index.js"
import { logger } from "../utils/logger.js"

export const createCompanySchema = z.object({
	name: z.string().min(1, "Company name is required"),
	size: z
		.enum(["startup", "small", "medium", "large", "enterprise"])
		.optional(),
	industry: z.string().optional(),
	funding_stage: z
		.enum([
			"bootstrapped",
			"seed",
			"series-a",
			"series-b",
			"series-c",
			"series-d",
			"ipo",
			"acquired",
			"unknown",
		])
		.optional(),
	glassdoor_url: z.url("Invalid URL format").optional().or(z.literal("")),
	culture_notes: z.string().optional(),
	pros: z.array(z.string()).default([]),
	cons: z.array(z.string()).default([]),
	interview_process_overview: z.string().optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>

export interface ICompanyWithApplications {
	_id: mongoose.Types.ObjectId
	user_id: mongoose.Types.ObjectId
	name: string
	size?: string
	industry?: string
	funding_stage?: string
	glassdoor_url?: string
	culture_notes?: string
	pros: string[]
	cons: string[]
	interview_process_overview?: string
	application_count?: number
	applications?: Array<{
		_id: mongoose.Types.ObjectId
		job_title: string
		status: string
		application_date: Date
	}>
	createdAt: Date
	updatedAt: Date
}

interface PaginatedCompanies {
	companies: ICompanyWithApplications[]
	totalCount: number
	currentPage: number
	pageSize: number
	totalPages: number
}

interface CompanyFilters {
	search?: string
	size?: string
	industry?: string
	funding_stage?: string
	sortBy?: string
	sortOrder?: "asc" | "desc"
}

export class CompanyService {
	static async create(
		userId: string,
		data: CreateCompanyInput
	): Promise<ICompanyWithApplications> {
		// Check if company with same name already exists for this user
		const existingCompany = await Company.findOne({
			user_id: userId,
			name: { $regex: new RegExp(`^${data.name}$`, "i") },
		})

		if (existingCompany) {
			throw new Error("Company with this name already exists")
		}

		const companyData: Record<string, unknown> = {
			user_id: userId,
			name: data.name,
		}
		if (data.size) companyData.size = data.size
		if (data.industry) companyData.industry = data.industry
		if (data.funding_stage) companyData.funding_stage = data.funding_stage
		if (data.glassdoor_url) companyData.glassdoor_url = data.glassdoor_url
		if (data.culture_notes) companyData.culture_notes = data.culture_notes
		if (data.interview_process_overview)
			companyData.interview_process_overview = data.interview_process_overview

		const company = await Company.create(companyData)
		const pros = data.pros || []
		const cons = data.cons || []
		if (pros.length + cons.length > 0) {
			await CompanyAttribute.insertMany([
				...pros.map((value) => ({
					company_id: company._id,
					kind: "pro" as const,
					value,
				})),
				...cons.map((value) => ({
					company_id: company._id,
					kind: "con" as const,
					value,
				})),
			])
		}

		return {
			...company.toObject(),
			pros,
			cons,
			application_count: 0,
			applications: [],
		} as ICompanyWithApplications
	}

	static async getById(
		companyId: string,
		userId: string,
		includeApplications: boolean = false
	): Promise<ICompanyWithApplications | null> {
		const company = await Company.findOne({
			_id: companyId,
			user_id: userId,
		}).lean()

		if (!company) {
			return null
		}

		const [attributes, applications] = await Promise.all([
			CompanyAttribute.find({ company_id: companyId }).lean(),
			includeApplications
				? JobApplication.find({
						company_id: companyId,
						user_id: userId,
					})
						.select("_id job_title status application_date")
						.sort({ application_date: -1 })
						.lean()
				: Promise.resolve([]),
		])
		const pros = attributes.filter((a) => a.kind === "pro").map((a) => a.value)
		const cons = attributes.filter((a) => a.kind === "con").map((a) => a.value)

		return {
			...company,
			pros,
			cons,
			application_count: includeApplications
				? applications.length
				: await JobApplication.countDocuments({
						company_id: companyId,
						user_id: userId,
					}),
			applications: applications.map((app) => ({
				_id: app._id,
				job_title: app.job_title,
				status: app.status,
				application_date: app.application_date,
			})),
		} as ICompanyWithApplications
	}

	static async getAll(
		userId: string,
		filters: CompanyFilters = {},
		page: number = 1,
		limit: number = 20
	): Promise<PaginatedCompanies> {
		const skip = (page - 1) * limit

		const query: Record<string, unknown> = { user_id: userId }

		if (filters.search) {
			query.name = { $regex: filters.search, $options: "i" }
		}

		if (filters.size) {
			query.size = filters.size
		}

		if (filters.industry) {
			query.industry = { $regex: filters.industry, $options: "i" }
		}

		if (filters.funding_stage) {
			query.funding_stage = filters.funding_stage
		}

		// Build sort object
		const sortField = filters.sortBy || "createdAt"
		const sortOrder = filters.sortOrder === "asc" ? 1 : -1
		const sort: Record<string, 1 | -1> = { [sortField]: sortOrder }

		const [companies, totalCount] = await Promise.all([
			Company.find(query).sort(sort).skip(skip).limit(limit).lean(),
			Company.countDocuments(query),
		])

		const companyIds = companies.map((c) => c._id)
		const attributes =
			companyIds.length > 0
				? await CompanyAttribute.find({
						company_id: { $in: companyIds },
					}).lean()
				: []
		const attrsByCompany = new Map<string, { pros: string[]; cons: string[] }>()
		for (const c of companyIds) {
			attrsByCompany.set(c.toString(), { pros: [], cons: [] })
		}
		for (const a of attributes) {
			const k = a.company_id.toString()
			const bag = attrsByCompany.get(k)
			if (bag) {
				if (a.kind === "pro") bag.pros.push(a.value)
				else bag.cons.push(a.value)
			}
		}

		// Get application counts for each company
		const companyIdStrs = companyIds.map((c) => c.toString())
		const applicationCountsResult = await JobApplication.aggregate([
			{
				$match: {
					company_id: {
						$in: companyIds,
					},
					user_id: new mongoose.Types.ObjectId(userId),
				},
			},
			{
				$group: {
					_id: "$company_id",
					count: { $sum: 1 },
				},
			},
		])
		const applicationCounts = applicationCountsResult as Array<{
			_id: mongoose.Types.ObjectId
			count: number
		}>

		const countMap = new Map<string, number>()
		for (const item of applicationCounts) {
			countMap.set(item._id.toString(), item.count)
		}

		const companiesWithCounts = companies.map((company) => {
			const attrs = attrsByCompany.get(company._id.toString()) ?? {
				pros: [] as string[],
				cons: [] as string[],
			}
			return {
				...company,
				pros: attrs.pros,
				cons: attrs.cons,
				application_count: countMap.get(company._id.toString()) || 0,
				applications: [],
			}
		}) as ICompanyWithApplications[]

		const totalPages = Math.ceil(totalCount / limit)

		return {
			companies: companiesWithCounts,
			totalCount,
			currentPage: page,
			pageSize: limit,
			totalPages,
		}
	}

	static async update(
		companyId: string,
		userId: string,
		data: UpdateCompanyInput
	): Promise<ICompanyWithApplications | null> {
		const existingCompany = await Company.findOne({
			_id: companyId,
			user_id: userId,
		}).lean()

		if (!existingCompany) {
			return null
		}

		// If name is being updated, check for duplicates
		if (data.name && data.name !== existingCompany.name) {
			const duplicateCompany = await Company.findOne({
				user_id: userId,
				name: { $regex: new RegExp(`^${data.name}$`, "i") },
				_id: { $ne: companyId },
			})

			if (duplicateCompany) {
				throw new Error("Company with this name already exists")
			}
		}

		const updateData: Record<string, unknown> = {}
		if (data.name !== undefined) updateData.name = data.name
		if (data.size !== undefined) updateData.size = data.size
		if (data.industry !== undefined) updateData.industry = data.industry
		if (data.funding_stage !== undefined)
			updateData.funding_stage = data.funding_stage
		if (data.glassdoor_url !== undefined)
			updateData.glassdoor_url = data.glassdoor_url || undefined
		if (data.culture_notes !== undefined)
			updateData.culture_notes = data.culture_notes
		if (data.interview_process_overview !== undefined)
			updateData.interview_process_overview = data.interview_process_overview

		if (data.pros !== undefined || data.cons !== undefined) {
			const existing = await CompanyAttribute.find({ company_id: companyId }).lean()
			const existingPros = existing.filter((a) => a.kind === "pro").map((a) => a.value)
			const existingCons = existing.filter((a) => a.kind === "con").map((a) => a.value)
			await CompanyAttribute.deleteMany({ company_id: companyId })
			const pros = data.pros ?? existingPros
			const cons = data.cons ?? existingCons
			if (pros.length > 0 || cons.length > 0) {
				await CompanyAttribute.insertMany([
					...pros.map((value: string) => ({ company_id: companyId, kind: "pro" as const, value })),
					...cons.map((value: string) => ({ company_id: companyId, kind: "con" as const, value })),
				])
			}
		}

		const company = await Company.findOneAndUpdate(
			{ _id: companyId, user_id: userId },
			{ $set: updateData },
			{ new: true, runValidators: true }
		).lean()

		if (!company) {
			return null
		}

		const [attrs, applicationCount] = await Promise.all([
			CompanyAttribute.find({ company_id: companyId }).lean(),
			JobApplication.countDocuments({
				company_id: companyId,
				user_id: userId,
			}),
		])
		const pros = attrs.filter((a) => a.kind === "pro").map((a) => a.value)
		const cons = attrs.filter((a) => a.kind === "con").map((a) => a.value)

		return {
			...company,
			pros,
			cons,
			application_count: applicationCount,
			applications: [],
		} as ICompanyWithApplications
	}

	static async delete(companyId: string, userId: string): Promise<boolean> {
		const company = await Company.findOne({
			_id: companyId,
			user_id: userId,
		}).lean()

		if (!company) {
			return false
		}

		// Remove company_id from all related job applications
		await JobApplication.updateMany(
			{ company_id: companyId, user_id: userId },
			{ $unset: { company_id: "" } }
		)

		// Delete the company
		const result = await Company.deleteOne({
			_id: companyId,
			user_id: userId,
		})

		logger.info("Company deleted", {
			companyId,
			userId,
			deleted: result.deletedCount > 0,
		})

		return result.deletedCount > 0
	}
}
