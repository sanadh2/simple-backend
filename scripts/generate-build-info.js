import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const buildEndTime = new Date().toISOString()
const buildEndTimestamp = Date.now()

// Try to read build start time if it exists
let buildStartTime = null
let buildStartTimestamp = null
let buildDuration = null

	try {
		const buildStartPath = join(__dirname, "../dist/build-start.json")
		const buildStart = JSON.parse(readFileSync(buildStartPath, "utf-8"))
		buildStartTime = buildStart.buildStartTime || null
		buildStartTimestamp = buildStart.buildStartTimestamp || null
		if (buildStartTimestamp) {
			buildDuration = buildEndTimestamp - buildStartTimestamp
		}
} catch (error) {
	// Build start file not found - this is okay, we'll just record end time
	console.log("Build start time not found, recording end time only")
}

const buildInfo = {
	buildStartTime,
	buildStartTimestamp,
	buildEndTime,
	buildEndTimestamp: buildEndTimestamp,
	buildDuration, // Duration in milliseconds
}

const outputPath = join(__dirname, "../dist/build-info.json")
const outputDir = dirname(outputPath)

// Ensure dist directory exists (it should from tsc, but just in case)
try {
	mkdirSync(outputDir, { recursive: true })
	writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), "utf-8")
	console.log(`✓ Build info written to ${outputPath}`)
	console.log(`  Build end time: ${buildEndTime}`)
	if (buildDuration !== null) {
		const seconds = (buildDuration / 1000).toFixed(2)
		console.log(`  Build duration: ${seconds} seconds`)
	}
} catch (error) {
	console.error("Failed to write build info:", error)
	process.exit(1)
}
