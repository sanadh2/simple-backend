import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const buildStartTime = new Date().toISOString()
const buildStartTimestamp = Date.now()

const outputPath = join(__dirname, "../dist/build-start.json")
const outputDir = dirname(outputPath)

try {
	mkdirSync(outputDir, { recursive: true })
	writeFileSync(
		outputPath,
		JSON.stringify(
			{
				buildStartTime,
				buildStartTimestamp,
			},
			null,
			2
		),
		"utf-8"
	)
	console.log(`✓ Build start time captured: ${buildStartTime}`)
} catch (error) {
	console.error("Failed to capture build start time:", error)
	process.exit(1)
}
