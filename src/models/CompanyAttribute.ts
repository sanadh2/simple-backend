import mongoose, { Document, Schema } from "mongoose"

export type CompanyAttributeKind = "pro" | "con"

export interface ICompanyAttribute extends Document {
	company_id: mongoose.Types.ObjectId
	kind: CompanyAttributeKind
	value: string
	createdAt: Date
	updatedAt: Date
}

const companyAttributeSchema = new Schema<ICompanyAttribute>(
	{
		company_id: {
			type: Schema.Types.ObjectId,
			ref: "Company",
			required: [true, "Company ID is required"],
			index: true,
		},
		kind: {
			type: String,
			enum: ["pro", "con"],
			required: [true, "Kind is required"],
			index: true,
		},
		value: {
			type: String,
			required: [true, "Value is required"],
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

companyAttributeSchema.index({ company_id: 1, kind: 1 })

export const CompanyAttribute = mongoose.model<ICompanyAttribute>(
	"CompanyAttribute",
	companyAttributeSchema
)
