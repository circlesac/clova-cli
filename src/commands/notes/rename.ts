import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { accountArg, noteContext } from "./context.ts"

export const renameCommand = defineLeafCommand({
	meta: {
		name: "rename",
		description: "Rename a note (change its title)"
	},
	args: {
		...noteArg,
		title: { type: "positional", description: "New note title", required: true },
		...commonArgs,
		...accountArg
	},
	async run({ args }) {
		try {
			const title = String(args.title ?? "").trim()
			if (!title) throw new ClovaCliError("A new title is required.", "MISSING_TITLE")
			const { client, noteId, workspaceId } = await noteContext(args)
			await client.renameNote(noteId, title, workspaceId)
			const format = getOutputFormat(args)
			if (format === "json") printOutput({ noteId, title }, format)
			else console.info(`\x1b[32m✓\x1b[0m Renamed note ${noteId} → "${title}"`)
		} catch (error) {
			handleError(error)
		}
	}
})
