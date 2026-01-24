import bcrypt from "bcryptjs"
import mongoose, { Document, Schema } from "mongoose"

import { DeviceFingerprint } from "./DeviceFingerprint.js"
import { RefreshToken } from "./RefreshToken.js"

export interface IUser extends Document {
	email: string
	password: string
	first_name: string
	last_name: string
	is_email_verified: boolean
	profile_picture?: string
	current_role?: string
	years_of_experience?: number
	tokens_invalidated_at?: Date
	timezone?: string | null
	reminder_time?: string | null
	email_verification_otp?: string
	email_verification_otp_expiry?: Date
	password_reset_otp?: string
	password_reset_otp_expiry?: Date
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
		first_name: {
			type: String,
			required: [true, "First name is required"],
			trim: true,
		},
		last_name: {
			type: String,
			required: [true, "Last name is required"],
			trim: true,
		},
		profile_picture: {
			type: String,
			default: null,
		},
		current_role: {
			type: String,
			default: null,
			trim: true,
		},
		years_of_experience: {
			type: Number,
			default: null,
			min: [0, "Years of experience cannot be negative"],
		},
		is_email_verified: {
			type: Boolean,
			default: false,
		},
		tokens_invalidated_at: {
			type: Date,
			default: null,
		},
		timezone: {
			type: String,
			default: null,
			trim: true,
		},
		reminder_time: {
			type: String,
			default: null,
			trim: true,
		},
		email_verification_otp: {
			type: String,
			select: false,
		},
		email_verification_otp_expiry: {
			type: Date,
			select: false,
		},
		password_reset_otp: {
			type: String,
			select: false,
		},
		password_reset_otp_expiry: {
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

userSchema.pre(
	["deleteOne", "findOneAndDelete"],
	{ document: false, query: true },
	async function () {
		const filter = this.getFilter() as Record<string, unknown>
		const userId = filter._id as mongoose.Types.ObjectId | string | undefined
		if (!userId) return
		const id =
			typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId
		await RefreshToken.deleteMany({ user_id: id })
		await DeviceFingerprint.deleteMany({ userId: id })
	}
)

userSchema.methods.comparePassword = async function (
	candidatePassword: string
): Promise<boolean> {
	return await bcrypt.compare(candidatePassword, this.password as string)
}

export const User = mongoose.model<IUser>("User", userSchema)
