import { mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const buildTime = new Date().toISOString()
const buildInfo = {
	buildTime,
	timestamp: Date.now(),
}

const outputPath = join(__dirname, "../dist/build-info.json")
const outputDir = dirname(outputPath)

// Ensure dist directory exists (it should from tsc, but just in case)
try {
	mkdirSync(outputDir, { recursive: true })
	writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), "utf-8")
	console.log(`✓ Build info written to ${outputPath}`)
	console.log(`  Build time: ${buildTime}`)
} catch (error) {
	console.error("Failed to write build info:", error)
	process.exit(1)
}
