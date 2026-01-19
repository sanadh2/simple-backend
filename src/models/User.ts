import bcrypt from "bcryptjs"
import mongoose, { Document, Schema } from "mongoose"

export interface IUser extends Document {
	email: string
	password: string
	firstName: string
	lastName: string
	isEmailVerified: boolean
	profilePicture?: string
	currentRole?: string
	yearsOfExperience?: number
	refreshTokens: string[]
	tokensInvalidatedAt?: Date
	emailVerificationOTP?: string
	emailVerificationOTPExpiry?: Date
	passwordResetOTP?: string
	passwordResetOTPExpiry?: Date
	createdAt: Date
	updatedAt: Date
	comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
	{
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			trim: true,
			match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			minlength: [8, "Password must be at least 8 characters"],
			select: false,
		},
		firstName: {
			type: String,
			required: [true, "First name is required"],
			trim: true,
		},
		lastName: {
			type: String,
			required: [true, "Last name is required"],
			trim: true,
		},
		profilePicture: {
			type: String,
			default: null,
		},
		currentRole: {
			type: String,
			default: null,
			trim: true,
		},
		yearsOfExperience: {
			type: Number,
			default: null,
			min: [0, "Years of experience cannot be negative"],
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		refreshTokens: {
			type: [String],
			default: [],
			select: false,
		},
		tokensInvalidatedAt: {
			type: Date,
			default: null,
		},
		emailVerificationOTP: {
			type: String,
			select: false,
		},
		emailVerificationOTPExpiry: {
			type: Date,
			select: false,
		},
		passwordResetOTP: {
			type: String,
			select: false,
		},
		passwordResetOTPExpiry: {
			type: Date,
			select: false,
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: (_doc, ret: Record<string, unknown>) => {
				const cleaned = { ...ret }
				delete cleaned.password
				delete cleaned.refreshTokens
				delete cleaned.__v
				return cleaned
			},
		},
	}
)

userSchema.pre("save", async function () {
	if (!this.isModified("password")) {
		return
	}

	const salt = await bcrypt.genSalt(12)
	this.password = await bcrypt.hash(this.password, salt)
})

userSchema.methods.comparePassword = async function (
	candidatePassword: string
): Promise<boolean> {
	return await bcrypt.compare(candidatePassword, this.password as string)
}

export const User = mongoose.model<IUser>("User", userSchema)
