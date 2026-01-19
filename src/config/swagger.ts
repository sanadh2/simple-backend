import swaggerJsdoc from "swagger-jsdoc"

import { env } from "./env.js"

const options: swaggerJsdoc.Options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Authentication API",
			version: "1.0.0",
			description:
				"A comprehensive authentication system using JWT and sessions",
			contact: {
				name: "API Support",
			},
		},
		servers: [
			{
				url: `http://localhost:${env.PORT}`,
				description: "Development server",
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "Enter your JWT access token",
				},
			},
			schemas: {
				User: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "User ID",
						},
						email: {
							type: "string",
							format: "email",
							description: "User email address",
						},
						first_name: {
							type: "string",
							description: "User first name",
						},
						last_name: {
							type: "string",
							description: "User last name",
						},
						isEmailVerified: {
							type: "boolean",
							description: "Whether the email is verified",
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "Account creation timestamp",
						},
						updatedAt: {
							type: "string",
							format: "date-time",
							description: "Account last update timestamp",
						},
					},
				},
				AuthTokens: {
					type: "object",
					properties: {
						accessToken: {
							type: "string",
							description: "JWT access token (short-lived)",
						},
						refreshToken: {
							type: "string",
							description: "JWT refresh token (long-lived)",
						},
					},
				},
				RegisterRequest: {
					type: "object",
					required: ["email", "password", "first_name", "last_name"],
					properties: {
						email: {
							type: "string",
							format: "email",
							example: "user@example.com",
						},
						password: {
							type: "string",
							minLength: 8,
							example: "SecurePass123",
						},
						first_name: {
							type: "string",
							example: "John",
						},
						last_name: {
							type: "string",
							example: "Doe",
						},
					},
				},
				LoginRequest: {
					type: "object",
					required: ["email", "password"],
					properties: {
						email: {
							type: "string",
							format: "email",
							example: "user@example.com",
						},
						password: {
							type: "string",
							example: "SecurePass123",
						},
					},
				},
				RefreshTokenRequest: {
					type: "object",
					properties: {
						refreshToken: {
							type: "string",
							description: "Refresh token (optional if using session)",
						},
					},
				},
				SuccessResponse: {
					type: "object",
					properties: {
						success: {
							type: "boolean",
							example: true,
						},
						message: {
							type: "string",
						},
						data: {
							type: "object",
						},
					},
				},
				ErrorResponse: {
					type: "object",
					properties: {
						success: {
							type: "boolean",
							example: false,
						},
						message: {
							type: "string",
						},
						error: {
							type: "string",
							description: "Error details (only in development)",
						},
					},
				},
			},
		},
		tags: [
			{
				name: "Authentication",
				description: "User authentication endpoints",
			},
		],
	},
	// Use compiled JS files in production, TS files in development
	apis: [
		env.NODE_ENV === "production" ? "./dist/routes/*.js" : "./src/routes/*.ts",
	],
}

export const swaggerSpec = swaggerJsdoc(options)
