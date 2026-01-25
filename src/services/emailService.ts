import fs from "fs"
import Handlebars from "handlebars"
import { createTransport, type Transporter } from "nodemailer"
import path from "path"
import { fileURLToPath } from "url"

import { env } from "../config/env.js"
import type { DeviceInfo } from "../types/deviceFingerprint.js"
import { logger } from "../utils/logger.js"

const BREVO_EMAIL_API = "https://api.brevo.com/v3/smtp/email"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface EmailOptions {
	to: string
	subject: string
	template: string
	context: Record<string, unknown>
}

export class EmailService {
	private static transporter: Transporter | null = null

	static initialize(): void {
		if (this.transporter) {
			return
		}
		// Production uses Brevo API; only init SMTP for development/test
		if (env.NODE_ENV === "production") {
			logger.info("Email service: using Brevo API in production")
			return
		}
		if (!env.SMTP_USER || !env.SMTP_PASS) {
			throw new Error(
				"SMTP_USER and SMTP_PASS are required in development and test"
			)
		}
		const transporter = createTransport({
			host: env.SMTP_HOST,
			port: env.SMTP_PORT,
			secure: env.SMTP_SECURE,
			auth: {
				user: env.SMTP_USER,
				pass: env.SMTP_PASS,
			},
		})
		this.transporter = transporter
		logger.info("Email service initialized (SMTP)", {
			host: env.SMTP_HOST,
			port: env.SMTP_PORT,
		})
	}

	private static loadTemplate(
		templateName: string
	): HandlebarsTemplateDelegate {
		const isProduction = env.NODE_ENV === "production"
		const baseDir = isProduction
			? path.join(__dirname, "..", "templates", "emails")
			: path.join(__dirname, "..", "..", "src", "templates", "emails")

		const templatePath = path.join(baseDir, `${templateName}.hbs`)
		const fallbackPath = path.join(
			process.cwd(),
			"src",
			"templates",
			"emails",
			`${templateName}.hbs`
		)

		let finalPath: string
		if (fs.existsSync(templatePath)) {
			finalPath = templatePath
		} else if (fs.existsSync(fallbackPath)) {
			finalPath = fallbackPath
		} else {
			throw new Error(
				`Email template not found: ${templateName}. Searched: ${templatePath}, ${fallbackPath}`
			)
		}

		const templateContent = fs.readFileSync(finalPath, "utf-8")
		return Handlebars.compile(templateContent)
	}

	static async sendEmail(options: EmailOptions): Promise<void> {
		const template = this.loadTemplate(options.template)
		const html = template(options.context)

		try {
			if (env.NODE_ENV === "production" && env.BREVO_API_KEY) {
				await this.sendViaBrevo({
					to: options.to,
					subject: options.subject,
					html,
				})
			} else {
				if (!this.transporter) {
					this.initialize()
				}
				if (!this.transporter) {
					throw new Error("Email transporter not initialized")
				}
				await this.transporter.sendMail({
					from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
					to: options.to,
					subject: options.subject,
					html,
				})
			}

			logger.info("Email sent successfully", {
				to: options.to,
				subject: options.subject,
				template: options.template,
			})
		} catch (error) {
			console.log("error sending email", error)
			console.dir(error, { depth: null })
			logger.error("Failed to send email", {
				error: error instanceof Error ? error.message : "Unknown error",
				to: options.to,
				template: options.template,
			})
			throw error
		}
	}

	private static async sendViaBrevo(payload: {
		to: string
		subject: string
		html: string
	}): Promise<void> {
		const apiKey = env.BREVO_API_KEY
		if (!apiKey) {
			throw new Error("BREVO_API_KEY is required in production")
		}
		const res = await fetch(BREVO_EMAIL_API, {
			method: "POST",
			headers: {
				"api-key": apiKey,
				"content-type": "application/json",
				accept: "application/json",
			},
			body: JSON.stringify({
				sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM },
				to: [{ email: payload.to }],
				subject: payload.subject,
				htmlContent: payload.html,
			}),
		})
		if (!res.ok) {
			const body = await res.text()
			throw new Error(`Brevo API error ${res.status}: ${body}`)
		}
	}

	static async sendVerificationOTP(
		email: string,
		first_name: string,
		otp: string
	): Promise<void> {
		await this.sendEmail({
			to: email,
			subject: "Verify Your Email Address",
			template: "email-verification",
			context: {
				first_name,
				otp,
				expiryMinutes: env.OTP_EXPIRY_MINUTES,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}

	static async sendPasswordResetOTP(
		email: string,
		first_name: string,
		otp: string
	): Promise<void> {
		await this.sendEmail({
			to: email,
			subject: "Reset Your Password",
			template: "password-reset",
			context: {
				first_name,
				otp,
				expiryMinutes: env.OTP_EXPIRY_MINUTES,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}

	static async sendNewDeviceAlert(
		email: string,
		first_name: string,
		deviceInfo: DeviceInfo
	): Promise<void> {
		const loginTime = new Date().toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZoneName: "short",
		})

		await this.sendEmail({
			to: email,
			subject: "New Device Login Alert",
			template: "new-device-alert",
			context: {
				first_name,
				deviceInfo,
				loginTime,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}

	static async sendFollowUpReminder(
		email: string,
		first_name: string,
		context: {
			contactName: string
			companyName: string
			jobTitle: string
			reminderDate: string
		}
	): Promise<void> {
		const applicationsUrl = `${env.FRONTEND_URL}/job-applications`

		await this.sendEmail({
			to: email,
			subject: "Follow-up Reminder: Contact Due Today",
			template: "follow-up-reminder",
			context: {
				first_name,
				contactName: context.contactName,
				companyName: context.companyName,
				jobTitle: context.jobTitle,
				reminderDate: context.reminderDate,
				applicationsUrl,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}

	static async sendInterviewReminder(
		email: string,
		first_name: string,
		context: {
			companyName: string
			jobTitle: string
			interviewType: string
			interviewFormat: string
			scheduledAt: string
		}
	): Promise<void> {
		const applicationsUrl = `${env.FRONTEND_URL}/job-applications`

		await this.sendEmail({
			to: email,
			subject: `Interview Tomorrow: ${context.companyName} – ${context.jobTitle}`,
			template: "interview-reminder",
			context: {
				first_name,
				companyName: context.companyName,
				jobTitle: context.jobTitle,
				interviewType: context.interviewType,
				interviewFormat: context.interviewFormat,
				scheduledAt: context.scheduledAt,
				applicationsUrl,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}
}
