import fs from "fs"
import Handlebars from "handlebars"
import { createTransport, type Transporter } from "nodemailer"
import path from "path"
import { fileURLToPath } from "url"

import { env } from "../config/env.js"
import { logger } from "../utils/logger.js"

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

		logger.info("Email service initialized", {
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
		if (!this.transporter) {
			this.initialize()
		}

		if (!this.transporter) {
			throw new Error("Email transporter not initialized")
		}

		try {
			const template = this.loadTemplate(options.template)
			const html = template(options.context)

			const mailOptions = {
				from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
				to: options.to,
				subject: options.subject,
				html,
			}

			await this.transporter.sendMail(mailOptions)

			logger.info("Email sent successfully", {
				to: options.to,
				subject: options.subject,
				template: options.template,
			})
		} catch (error) {
			logger.error("Failed to send email", {
				error: error instanceof Error ? error.message : "Unknown error",
				to: options.to,
				template: options.template,
			})
			throw error
		}
	}

	static async sendVerificationOTP(
		email: string,
		firstName: string,
		otp: string
	): Promise<void> {
		await this.sendEmail({
			to: email,
			subject: "Verify Your Email Address",
			template: "email-verification",
			context: {
				firstName,
				otp,
				expiryMinutes: env.OTP_EXPIRY_MINUTES,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}

	static async sendPasswordResetOTP(
		email: string,
		firstName: string,
		otp: string
	): Promise<void> {
		await this.sendEmail({
			to: email,
			subject: "Reset Your Password",
			template: "password-reset",
			context: {
				firstName,
				otp,
				expiryMinutes: env.OTP_EXPIRY_MINUTES,
				appName: env.EMAIL_FROM_NAME,
			},
		})
	}
}
