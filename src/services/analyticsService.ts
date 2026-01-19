import { User } from "../models/index.js"

interface UserStatistics {
	totalUsers: number
	verifiedUsers: number
	unverifiedUsers: number
	verificationRate: number
}

interface RegistrationTrend {
	date: string
	count: number
	users: Array<{ email: string; name: string; isVerified: boolean }>
}

interface SessionAnalysis {
	statistics: {
		totalActiveSessions: number
		averageSessionsPerUser: number
		maxSessions: number
		usersWithSessions: number
		usersWithMultipleSessions: number
	}
	topUsers: Array<{
		fullName: string
		email: string
		sessionCount: number
	}>
}

interface SearchResult {
	fullName: string
	email: string
	isEmailVerified: boolean
	createdAt: Date
}

interface PaginatedUsers {
	users: SearchResult[]
	totalCount: number
	currentPage: number
	pageSize: number
	totalPages: number
}

interface InactiveUser {
	fullName: string
	email: string
	isEmailVerified: boolean
	createdAt: Date
	daysSinceCreation: number
}

interface EmailDomainStat {
	domain: string
	totalUsers: number
	verifiedUsers: number
	unverifiedUsers: number
	verificationRate: number
}

interface CohortData {
	cohort: string
	totalUsers: number
	activeUsers: number
	inactiveUsers: number
	retentionRate: number
}

interface PowerUser {
	fullName: string
	email: string
	sessionCount: number
	createdAt: Date
	accountAgeDays: number
}

export class AnalyticsService {
	static async getUserStatistics(): Promise<UserStatistics> {
		const stats = await User.aggregate([
			{
				$group: {
					_id: null,
					totalUsers: { $sum: 1 },
					verifiedUsers: {
						$sum: { $cond: [{ $eq: ["$is_email_verified", true] }, 1, 0] },
					},
					unverifiedUsers: {
						$sum: { $cond: [{ $eq: ["$is_email_verified", false] }, 1, 0] },
					},
				},
			},
			{
				$addFields: {
					verificationRate: {
						$cond: [
							{ $eq: ["$totalUsers", 0] },
							0,
							{
								$round: [
									{
										$multiply: [
											{ $divide: ["$verifiedUsers", "$totalUsers"] },
											100,
										],
									},
									2,
								],
							},
						],
					},
				},
			},
			{
				$project: {
					_id: 0,
				},
			},
		])

		const result = stats[0] as UserStatistics | undefined
		return (
			result || {
				totalUsers: 0,
				verifiedUsers: 0,
				unverifiedUsers: 0,
				verificationRate: 0,
			}
		)
	}

	static async getRegistrationTrends(
		days: number = 30
	): Promise<RegistrationTrend[]> {
		const startDate = new Date()
		startDate.setDate(startDate.getDate() - days)

		return await User.aggregate([
			{
				$match: {
					createdAt: { $gte: startDate },
				},
			},
			{
				$group: {
					_id: {
						$dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
					},
					count: { $sum: 1 },
					users: {
						$push: {
							email: "$email",
							name: { $concat: ["$first_name", " ", "$last_name"] },
							isVerified: "$is_email_verified",
						},
					},
				},
			},
			{
				$sort: { _id: -1 },
			},
			{
				$project: {
					date: "$_id",
					count: 1,
					users: 1,
					_id: 0,
				},
			},
		])
	}

	static async getActiveSessionsAnalysis(): Promise<SessionAnalysis> {
		const result = await User.aggregate([
			{
				$project: {
					email: 1,
					first_name: 1,
					last_name: 1,
					sessionCount: { $size: { $ifNull: ["$refresh_tokens", []] } },
				},
			},
			{
				$match: {
					sessionCount: { $gt: 0 },
				},
			},
			{
				$sort: { sessionCount: -1 },
			},
			{
				$facet: {
					statistics: [
						{
							$group: {
								_id: null,
								totalActiveSessions: { $sum: "$sessionCount" },
								averageSessionsPerUser: { $avg: "$sessionCount" },
								maxSessions: { $max: "$sessionCount" },
								usersWithSessions: { $sum: 1 },
								usersWithMultipleSessions: {
									$sum: { $cond: [{ $gt: ["$sessionCount", 1] }, 1, 0] },
								},
							},
						},
						{
							$project: {
								_id: 0,
								totalActiveSessions: 1,
								averageSessionsPerUser: {
									$round: ["$averageSessionsPerUser", 2],
								},
								maxSessions: 1,
								usersWithSessions: 1,
								usersWithMultipleSessions: 1,
							},
						},
					],
					topUsers: [
						{ $limit: 10 },
						{
							$project: {
								fullName: { $concat: ["$first_name", " ", "$last_name"] },
								email: 1,
								sessionCount: 1,
							},
						},
					],
				},
			},
			{
				$project: {
					statistics: { $arrayElemAt: ["$statistics", 0] },
					topUsers: 1,
				},
			},
		])

		const data = result[0] as SessionAnalysis | undefined
		return (
			data || {
				statistics: {
					totalActiveSessions: 0,
					averageSessionsPerUser: 0,
					maxSessions: 0,
					usersWithSessions: 0,
					usersWithMultipleSessions: 0,
				},
				topUsers: [],
			}
		)
	}

	static async searchUsersByName(
		searchTerm: string,
		limit: number = 20
	): Promise<SearchResult[]> {
		return await User.aggregate([
			{
				$addFields: {
					fullName: { $concat: ["$first_name", " ", "$last_name"] },
				},
			},
			{
				$match: {
					fullName: { $regex: searchTerm, $options: "i" },
				},
			},
			{
				$project: {
					fullName: 1,
					email: 1,
					is_email_verified: 1,
					createdAt: 1,
				},
			},
			{
				$sort: { createdAt: -1 },
			},
			{
				$limit: limit,
			},
		])
	}

	static async getUsersWithPagination(
		page: number = 1,
		limit: number = 10
	): Promise<PaginatedUsers> {
		const skip = (page - 1) * limit

		const result = await User.aggregate([
			{
				$facet: {
					metadata: [
						{ $count: "totalCount" },
						{
							$addFields: {
								page,
								limit,
								totalPages: { $ceil: { $divide: ["$totalCount", limit] } },
							},
						},
					],
					users: [
						{ $sort: { createdAt: -1 } },
						{ $skip: skip },
						{ $limit: limit },
						{
							$project: {
								fullName: { $concat: ["$first_name", " ", "$last_name"] },
								email: 1,
								is_email_verified: 1,
								createdAt: 1,
							},
						},
					],
				},
			},
			{
				$project: {
					users: 1,
					metadata: { $arrayElemAt: ["$metadata", 0] },
				},
			},
		])

		const data = result[0] as
			| {
					users: SearchResult[]
					metadata?: { totalCount: number; totalPages: number }
			  }
			| undefined
		return {
			users: data?.users || [],
			totalCount: data?.metadata?.totalCount || 0,
			currentPage: page,
			pageSize: limit,
			totalPages: data?.metadata?.totalPages || 0,
		}
	}

	static async getInactiveUsers(
		daysInactive: number = 30
	): Promise<InactiveUser[]> {
		const inactiveDate = new Date()
		inactiveDate.setDate(inactiveDate.getDate() - daysInactive)

		return await User.aggregate([
			{
				$match: {
					createdAt: { $lt: inactiveDate },
					$or: [
						{ refresh_tokens: { $exists: false } },
						{ refresh_tokens: { $size: 0 } },
					],
				},
			},
			{
				$project: {
					fullName: { $concat: ["$first_name", " ", "$last_name"] },
					email: 1,
					is_email_verified: 1,
					createdAt: 1,
					daysSinceCreation: {
						$round: [
							{
								$divide: [
									{ $subtract: [new Date(), "$createdAt"] },
									1000 * 60 * 60 * 24,
								],
							},
							0,
						],
					},
				},
			},
			{
				$sort: { createdAt: 1 },
			},
		])
	}

	static async getEmailDomainStats(): Promise<EmailDomainStat[]> {
		return await User.aggregate([
			{
				$project: {
					domain: {
						$arrayElemAt: [{ $split: ["$email", "@"] }, 1],
					},
					isEmailVerified: 1,
				},
			},
			{
				$group: {
					_id: "$domain",
					totalUsers: { $sum: 1 },
					verifiedUsers: {
						$sum: { $cond: ["$isEmailVerified", 1, 0] },
					},
				},
			},
			{
				$sort: { totalUsers: -1 },
			},
			{
				$project: {
					domain: "$_id",
					totalUsers: 1,
					verifiedUsers: 1,
					unverifiedUsers: { $subtract: ["$totalUsers", "$verifiedUsers"] },
					verificationRate: {
						$round: [
							{
								$multiply: [
									{ $divide: ["$verifiedUsers", "$totalUsers"] },
									100,
								],
							},
							2,
						],
					},
					_id: 0,
				},
			},
		])
	}

	static async getCohortAnalysis(): Promise<CohortData[]> {
		return await User.aggregate([
			{
				$project: {
					cohortMonth: {
						$dateToString: { format: "%Y-%m", date: "$createdAt" },
					},
					hasActiveSessions: {
						$gt: [{ $size: { $ifNull: ["$refresh_tokens", []] } }, 0],
					},
				},
			},
			{
				$group: {
					_id: "$cohortMonth",
					totalUsers: { $sum: 1 },
					activeUsers: {
						$sum: { $cond: ["$hasActiveSessions", 1, 0] },
					},
				},
			},
			{
				$project: {
					cohort: "$_id",
					totalUsers: 1,
					activeUsers: 1,
					inactiveUsers: { $subtract: ["$totalUsers", "$activeUsers"] },
					retentionRate: {
						$round: [
							{
								$multiply: [{ $divide: ["$activeUsers", "$totalUsers"] }, 100],
							},
							2,
						],
					},
					_id: 0,
				},
			},
			{
				$sort: { cohort: -1 },
			},
		])
	}

	static async getPowerUsers(): Promise<PowerUser[]> {
		const ninetyDaysAgo = new Date()
		ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

		return await User.aggregate([
			{
				$match: {
					is_email_verified: true,
					createdAt: { $gte: ninetyDaysAgo },
				},
			},
			{
				$addFields: {
					sessionCount: { $size: { $ifNull: ["$refresh_tokens", []] } },
				},
			},
			{
				$match: {
					sessionCount: { $gte: 2 },
				},
			},
			{
				$project: {
					fullName: { $concat: ["$first_name", " ", "$last_name"] },
					email: 1,
					sessionCount: 1,
					createdAt: 1,
					accountAgeDays: {
						$round: [
							{
								$divide: [
									{ $subtract: [new Date(), "$createdAt"] },
									1000 * 60 * 60 * 24,
								],
							},
							0,
						],
					},
				},
			},
			{
				$sort: { sessionCount: -1, accountAgeDays: 1 },
			},
		])
	}
}
