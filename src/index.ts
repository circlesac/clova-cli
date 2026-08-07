import { defineCommand, runMain } from "citty"
import pkg from "../package.json"
import { authCommand } from "./commands/auth/index.ts"
import { noteCommand } from "./commands/notes/index.ts"
import { checkForUpdate } from "./lib/update-check.ts"

const version = (pkg as { version?: string }).version ?? "0.0.0"

const main = defineCommand({
	meta: {
		name: pkg.name,
		version,
		description: "CLOVA Note CLI — transcripts, summaries, speakers, and audio from the terminal"
	},
	subCommands: {
		auth: authCommand,
		note: noteCommand
	}
})

await checkForUpdate()
runMain(main)
