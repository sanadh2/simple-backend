import mongoose, { Document, Schema } from "mongoose"

export type CompanySize =
	| "startup"
	| "small"
	| "medium"
	| "large"
	| "enterprise"

export type FundingStage =
	| "bootstrapped"
	| "seed"
	| "series-a"
	| "series-b"
	| "series-c"
	| "series-d"
	| "ipo"
	| "acquired"
	| "unknown"

export interface ICompany extends Document {
	user_id: mongoose.Types.ObjectId
	name: string
	size?: CompanySize
	industry?: string
	funding_stage?: FundingStage
	glassdoor_url?: string
	culture_notes?: string
	pros: string[]
	cons: string[]
	interview_process_overview?: string
	createdAt: Date
	updatedAt: Date
}

const companySchema = new Schema<ICompany>(
	{
		user_id: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
			index: true,
		},
		name: {
			type: String,
			required: [true, "Company name is required"],
			trim: true,
			index: true,
		},
		size: {
			type: String,
			enum: ["startup", "small", "medium", "large", "enterprise"],
			trim: true,
		},
		industry: {
			type: String,
			trim: true,
		},
		funding_stage: {
			type: String,
			enum: [
				"bootstrapped",
				"seed",
				"series-a",
				"series-b",
				"series-c",
				"series-d",
				"ipo",
				"acquired",
				"unknown",
			],
			trim: true,
		},
		glassdoor_url: {
			type: String,
			trim: true,
			validate: {
				validator: function (v: string | undefined) {
					if (!v) return true
					return /^https?:\/\/.+/.test(v)
				},
				message: "Glassdoor URL must be a valid URL",
			},
		},
		culture_notes: {
			type: String,
			trim: true,
		},
		pros: {
			type: [String],
			default: [],
		},
		cons: {
			type: [String],
			default: [],
		},
		interview_process_overview: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: (_doc, ret: Record<string, unknown>) => {
				const cleaned = { ...ret }
				delete cleaned.__v
				return cleaned
			},
		},
	}
)

companySchema.index({ user_id: 1, name: 1 }, { unique: true })
companySchema.index({ user_id: 1, createdAt: -1 })

export const Company = mongoose.model<ICompany>("Company", companySchema)
