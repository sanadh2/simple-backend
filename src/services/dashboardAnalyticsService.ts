import mongoose from "mongoose"

import { Interview, JobApplication, StatusHistory } from "../models/index.js"

const OBJECT_ID = mongoose.Types.ObjectId

export interface ApplicationFunnel {
	applied: number
	interview: number
	offer: number
}

export interface DashboardAnalytics {
	funnel: ApplicationFunnel
	responseRate: number
	interviewConversionRate: number
	avgTimeToHearBackDays: number | null
	avgTimeBetweenInterviewRoundsDays: number | null
	successByApplicationMethod: Array<{
		method: string
		total: number
		success: number
		rate: number
	}>
	bestDaysToApply: Array<{
		day: string
		applications: number
		responseCount: number
		responseRate: number
	}>
	bestHoursToApply: Array<{
		hour: number
		label: string
		applications: number
		responseCount: number
		responseRate: number
	}>
	salaryRange: {
		min: number | null
		max: number | null
		median: number | null
		sampleCount: number
		currency: string
		periodLabel: "annual" | "monthly" | "hourly" | "mixed"
		byPeriod: { annual: number; monthly: number; hourly: number }
		distribution: Array<{ range: string; count: number }>
	}
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
]
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
	const h = i % 12 || 12
	const am = i < 12 ? "AM" : "PM"
	return `${h} ${am}`
})

const HOURS_PER_YEAR = 2080 // 40h * 52w
const MONTHS_PER_YEAR = 12

/**
 * Parse salary_range: detects currency, period (annual/monthly/hourly), and normalizes to annual equivalent in thousands.
 * Examples: "$50k-$70k", "€40,000/year", "£15/hour", "3000 EUR/month", "25-30 USD/hour"
 */
function parseSalaryRange(s: string): {
	min: number
	max: number
	currency: string
	period: "annual" | "monthly" | "hourly"
} | null {
	if (!s || typeof s !== "string") return null
	const raw = s.trim()
	const lower = raw.toLowerCase()

	// --- Detect currency (symbols and common codes; check R$, mx$ before $)
	let currency = "unknown"
	if (/r\$|brl|reais?/.test(lower)) {
		currency = "BRL"
	} else if (/mx\$|mxn|pesos?/.test(lower)) {
		currency = "MXN"
	} else if (/\$|usd|dollars?/.test(lower)) {
		currency = "USD"
	} else if (/€|eur|euros?/.test(lower)) {
		currency = "EUR"
	} else if (/£|gbp|pounds?/.test(lower)) {
		currency = "GBP"
	} else if (/chf|swiss/.test(lower)) {
		currency = "CHF"
	} else if (/cad|canadian/.test(lower)) {
		currency = "CAD"
	} else if (/aud|australian/.test(lower)) {
		currency = "AUD"
	} else if (/¥|jpy|yen/.test(lower)) {
		currency = "JPY"
	} else if (/₩|krw|won/.test(lower)) {
		currency = "KRW"
	} else if (/₹|inr|rupees?/.test(lower)) {
		currency = "INR"
	}

	// --- Detect period (annual / monthly / hourly); default annual
	let period: "annual" | "monthly" | "hourly" = "annual"
	if (/\/(hour|hr|h\b)|hourly|per\s*hour|per\s*hr\b/.test(lower)) {
		period = "hourly"
	} else if (
		/\/(month|mo|mth)|monthly|per\s*month|per\s*mo\b|p\.?m\.?\b/.test(lower)
	) {
		period = "monthly"
	} else if (/\/(year|yr)|yearly|annually|per\s*year|p\.?a\.?\b/.test(lower)) {
		period = "annual"
	}

	// --- Remove currency and period words/symbols for number extraction (keep digits, ., comma, k, -)
	const forNum = lower
		.replace(/\s*r\s*\$\s*/g, " ")
		.replace(/\s*mx\s*\$\s*/g, " ")
		.replace(/[$€£¥₩₹,\s]/g, " ")
		.replace(
			/\b(usd|eur|gbp|chf|cad|aud|jpy|krw|brl|inr|mxn|dollars?|euros?|pounds?|yen|won|reais?|rupees?|pesos?)\b/gi,
			" "
		)
		.replace(
			/\/(year|yr|month|mo|mth|hour|hr|h)\b|hourly|monthly|yearly|annually|per\s*(year|month|hour|mo|hr)\b/gi,
			" "
		)
		.replace(/\s+/g, " ")
		.trim()

	// --- toNum: raw value in base unit (50k -> 50000, 50000 -> 50000, 25 -> 25)
	const toNum = (v: string): number => {
		const t = v.replace(/[\s,]/g, "").toLowerCase()
		const m = t.match(/^([\d.]+)k$/)
		if (m && m[1] !== undefined) {
			return parseFloat(m[1]) * 1000
		}
		const m2 = t.match(/^([\d.]+)$/)
		if (m2 && m2[1] !== undefined) return parseFloat(m2[1])
		return NaN
	}

	// --- Extract min/max from "a-b", "a to b", or single
	const parts = forNum.split(/-|–|—|to/).map((p) => p.trim())
	const p0 = parts[0]
	const p1 = parts[1]
	let rawMin: number
	let rawMax: number
	if (p0 !== undefined && p1 !== undefined) {
		const a = toNum(p0)
		const b = toNum(p1)
		if (Number.isNaN(a) || Number.isNaN(b)) return null
		rawMin = Math.min(a, b)
		rawMax = Math.max(a, b)
	} else {
		const single = toNum(forNum)
		if (Number.isNaN(single)) return null
		rawMin = single
		rawMax = single
	}

	// --- Normalize to "thousands annual equivalent"
	const toThousandsAnnual = (raw: number): number => {
		switch (period) {
			case "annual":
				return raw / 1000
			case "monthly":
				return (raw * MONTHS_PER_YEAR) / 1000
			case "hourly":
				return (raw * HOURS_PER_YEAR) / 1000
			default:
				return raw / 1000
		}
	}

	return {
		min: toThousandsAnnual(rawMin),
		max: toThousandsAnnual(rawMax),
		currency,
		period,
	}
}

export class DashboardAnalyticsService {
	static async getDashboardAnalytics(
		userId: string
	): Promise<DashboardAnalytics> {
		const uid = new OBJECT_ID(userId)

		const applications = await JobApplication.find({ user_id: uid })
			.select("_id application_date status application_method salary_range")
			.lean()

		const appIds = applications.map((a) => a._id)

		const [interviewsResolved, statusHistories] = await Promise.all([
			appIds.length === 0
				? Promise.resolve([])
				: Interview.find({ job_application_id: { $in: appIds } })
						.sort({ scheduled_at: 1 })
						.lean(),
			appIds.length === 0
				? Promise.resolve([])
				: StatusHistory.find({ job_application_id: { $in: appIds } })
						.sort({ changed_at: 1 })
						.lean(),
		])

		const statusByApp = new Map<
			string,
			Array<{ status: string; changed_at: Date }>
		>()
		for (const h of statusHistories) {
			const id = h.job_application_id.toString()
			let arr = statusByApp.get(id)
			if (!arr) {
				arr = []
				statusByApp.set(id, arr)
			}
			arr.push({ status: h.status, changed_at: h.changed_at })
		}

		// --- Funnel: applied (excluding Wishlist) -> interview (scheduled|interviewing|offer) -> offer (Offer|Accepted)
		const applied = applications.filter(
			(a) => a.status !== "Wishlist" && a.status !== "Withdrawn"
		)
		const toInterview = new Set(
			["Interview Scheduled", "Interviewing", "Offer", "Accepted"].filter(
				() => true
			)
		)
		const toOffer = new Set(["Offer", "Accepted"])
		const funnel: ApplicationFunnel = {
			applied: applied.length,
			interview: applied.filter((a) => toInterview.has(a.status)).length,
			offer: applied.filter((a) => toOffer.has(a.status)).length,
		}

		// --- Response rate: of applications beyond Wishlist/Withdrawn, % that got any response (left Applied)
		const gotResponse = (a: (typeof applications)[0]): boolean => {
			const hist = statusByApp.get(a._id.toString()) ?? []
			const leftApplied = hist.some(
				(e) =>
					!["Wishlist", "Applied"].includes(e.status) &&
					e.status !== "Withdrawn"
			)
			return (
				leftApplied || !["Wishlist", "Applied", "Withdrawn"].includes(a.status)
			)
		}
		const appliedForResponse = applications.filter(
			(a) => a.status !== "Wishlist" && a.status !== "Withdrawn"
		)
		const respondedCount = appliedForResponse.filter(gotResponse).length
		const responseRate =
			appliedForResponse.length > 0
				? Math.round((respondedCount / appliedForResponse.length) * 10000) / 100
				: 0

		// --- Interview conversion: of those who had at least one interview, % that got Offer|Accepted
		const appsWithInterview = new Set(
			interviewsResolved.map((i) => i.job_application_id.toString())
		)
		const withInterview = applied.filter((a) =>
			appsWithInterview.has(a._id.toString())
		)
		const gotOffer = withInterview.filter((a) => toOffer.has(a.status))
		const interviewConversionRate =
			withInterview.length > 0
				? Math.round((gotOffer.length / withInterview.length) * 10000) / 100
				: 0

		// --- Avg time to hear back: application_date -> first status change from Applied to non-Applied (excluding Withdrawn)
		const RESPONSE_STATUSES = new Set([
			"Interview Scheduled",
			"Interviewing",
			"Offer",
			"Rejected",
			"Accepted",
		])
		const durations: number[] = []
		for (const a of applications) {
			if (a.status === "Wishlist" || a.status === "Withdrawn") continue
			const hist = statusByApp.get(a._id.toString()) ?? []
			const appDate = new Date(a.application_date).getTime()
			const firstResponse = hist.find(
				(e) => RESPONSE_STATUSES.has(e.status) || e.status === "Rejected"
			)
			if (firstResponse) {
				const diff =
					(new Date(firstResponse.changed_at).getTime() - appDate) /
					(1000 * 60 * 60 * 24)
				if (diff >= 0) durations.push(diff)
			}
		}
		const avgTimeToHearBackDays =
			durations.length > 0
				? Math.round(
						(durations.reduce((s, d) => s + d, 0) / durations.length) * 10
					) / 10
				: null

		// --- Avg time between interview rounds (consecutive scheduled_at per application)
		const byApp = new Map<string, { scheduled_at: Date }[]>()
		for (const i of interviewsResolved) {
			const id = i.job_application_id.toString()
			let arr = byApp.get(id)
			if (!arr) {
				arr = []
				byApp.set(id, arr)
			}
			arr.push({ scheduled_at: i.scheduled_at })
		}
		const roundDiffs: number[] = []
		for (const [, arr] of byApp) {
			arr.sort(
				(x, y) =>
					new Date(x.scheduled_at).getTime() -
					new Date(y.scheduled_at).getTime()
			)
			for (let i = 1; i < arr.length; i++) {
				const curr = arr[i]
				const prev = arr[i - 1]
				if (curr !== undefined && prev !== undefined) {
					const d =
						(new Date(curr.scheduled_at).getTime() -
							new Date(prev.scheduled_at).getTime()) /
						(1000 * 60 * 60 * 24)
					if (d >= 0) roundDiffs.push(d)
				}
			}
		}
		const avgTimeBetweenInterviewRoundsDays =
			roundDiffs.length > 0
				? Math.round(
						(roundDiffs.reduce((s, d) => s + d, 0) / roundDiffs.length) * 10
					) / 10
				: null

		// --- Success rate by application method
		const byMethod = new Map<string, { total: number; success: number }>()
		const methodLabel = (m: string | undefined) =>
			m && m.trim() ? m.trim() : "Not specified"
		for (const a of applications) {
			if (a.status === "Wishlist" || a.status === "Withdrawn") continue
			const method = methodLabel(a.application_method)
			let r = byMethod.get(method)
			if (!r) {
				r = { total: 0, success: 0 }
				byMethod.set(method, r)
			}
			r.total += 1
			if (toOffer.has(a.status)) r.success += 1
		}
		const successByApplicationMethod = Array.from(byMethod.entries())
			.map(([method, v]) => ({
				method,
				total: v.total,
				success: v.success,
				rate: v.total > 0 ? Math.round((v.success / v.total) * 10000) / 100 : 0,
			}))
			.sort((a, b) => b.total - a.total)

		// --- Best days/hours to apply: by application_date, success = got response
		const byDay = new Map<
			number,
			{ applications: number; responseCount: number }
		>()
		const byHour = new Map<
			number,
			{ applications: number; responseCount: number }
		>()
		for (let i = 0; i < 7; i++)
			byDay.set(i, { applications: 0, responseCount: 0 })
		for (let i = 0; i < 24; i++)
			byHour.set(i, { applications: 0, responseCount: 0 })

		for (const a of applications) {
			if (a.status === "Wishlist" || a.status === "Withdrawn") continue
			const d = new Date(a.application_date)
			const day = d.getDay()
			const hour = d.getHours()
			const resp = gotResponse(a)
			const dayEntry = byDay.get(day)
			if (dayEntry) {
				dayEntry.applications += 1
				if (resp) dayEntry.responseCount += 1
			}
			const hourEntry = byHour.get(hour)
			if (hourEntry) {
				hourEntry.applications += 1
				if (resp) hourEntry.responseCount += 1
			}
		}

		const bestDaysToApply = DAY_NAMES.map((name, i) => {
			const r = byDay.get(i) ?? { applications: 0, responseCount: 0 }
			return {
				day: name,
				applications: r.applications,
				responseCount: r.responseCount,
				responseRate:
					r.applications > 0
						? Math.round((r.responseCount / r.applications) * 10000) / 100
						: 0,
			}
		}).filter((x) => x.applications > 0)

		const bestHoursToApply = HOUR_LABELS.map((label, hour) => {
			const r = byHour.get(hour) ?? { applications: 0, responseCount: 0 }
			return {
				hour,
				label,
				applications: r.applications,
				responseCount: r.responseCount,
				responseRate:
					r.applications > 0
						? Math.round((r.responseCount / r.applications) * 10000) / 100
						: 0,
			}
		}).filter((x) => x.applications > 0)

		// --- Salary range analysis (supports multiple currencies, hourly/monthly/annual; normalizes to annual equivalent)
		const parsed: Array<{
			min: number
			max: number
			currency: string
			period: "annual" | "monthly" | "hourly"
		}> = []
		for (const a of applications) {
			const p = parseSalaryRange(a.salary_range ?? "")
			if (p) parsed.push(p)
		}

		const currencies = new Set(parsed.map((p) => p.currency))
		const currencyLabel =
			currencies.size > 1
				? "mixed"
				: currencies.size === 1
					? ([...currencies][0] ?? "unknown")
					: "unknown"

		const byPeriod = { annual: 0, monthly: 0, hourly: 0 }
		for (const p of parsed) {
			byPeriod[p.period] += 1
		}
		const periodLabel: "annual" | "monthly" | "hourly" | "mixed" =
			byPeriod.annual > 0 && byPeriod.monthly === 0 && byPeriod.hourly === 0
				? "annual"
				: byPeriod.monthly > 0 && byPeriod.annual === 0 && byPeriod.hourly === 0
					? "monthly"
					: byPeriod.hourly > 0 &&
						  byPeriod.annual === 0 &&
						  byPeriod.monthly === 0
						? "hourly"
						: "mixed"

		const allValues: number[] = []
		for (const p of parsed) {
			allValues.push(p.min, p.max)
		}
		allValues.sort((a, b) => a - b)
		const n = allValues.length
		let median: number | null = null
		if (n > 0) {
			if (n % 2 === 1) {
				const v = allValues[Math.floor(n / 2)]
				median = v ?? null
			} else {
				const lo = allValues[n / 2 - 1]
				const hi = allValues[n / 2]
				median = lo !== undefined && hi !== undefined ? (lo + hi) / 2 : null
			}
		}

		// Distribution: annual equivalent in thousands (0-50k, 50-100k, …)
		const buckets = [
			{ min: 0, max: 50, range: "0–50k", count: 0 },
			{ min: 50, max: 100, range: "50–100k", count: 0 },
			{ min: 100, max: 150, range: "100–150k", count: 0 },
			{ min: 150, max: 200, range: "150–200k", count: 0 },
			{ min: 200, max: Infinity, range: "200k+", count: 0 },
		]
		for (const p of parsed) {
			const mid = (p.min + p.max) / 2
			const b = buckets.find((x) => mid >= x.min && mid < x.max)
			if (b) b.count += 1
		}

		const salaryRange = {
			min:
				allValues.length > 0
					? Math.round(Math.min(...allValues) * 10) / 10
					: null,
			max:
				allValues.length > 0
					? Math.round(Math.max(...allValues) * 10) / 10
					: null,
			median:
				median !== null && median !== undefined
					? Math.round(median * 10) / 10
					: null,
			sampleCount: parsed.length,
			currency: currencyLabel,
			periodLabel,
			byPeriod,
			distribution: buckets
				.map((b) => ({ range: b.range, count: b.count }))
				.filter((d) => d.count > 0),
		}

		return {
			funnel,
			responseRate,
			interviewConversionRate,
			avgTimeToHearBackDays,
			avgTimeBetweenInterviewRoundsDays,
			successByApplicationMethod,
			bestDaysToApply,
			bestHoursToApply,
			salaryRange,
		}
	}
}
