import { createInterface } from "node:readline"
import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { accountArg, noteContext } from "./context.ts"

function confirm(question: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
		rl.question(question, (answer) => {
			rl.close()
			resolve(/^y(es)?$/i.test(answer.trim()))
		})
	})
}

export const deleteCommand = defineLeafCommand({
	meta: {
		name: "delete",
		description: "Delete a note (asks for confirmation unless --yes)"
	},
	args: {
		...noteArg,
		yes: { type: "boolean" as const, description: "Skip the confirmation prompt", alias: "y" },
		...commonArgs,
		...accountArg
	},
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)

			// Show the title so the user can confirm they're deleting the right note.
			let title = ""
			try {
				const note = await client.getNote(noteId, workspaceId)
				title = note.noteInfo.noteName ?? ""
			} catch {
				// Metadata fetch is best-effort; deletion does not depend on it.
			}

			if (!args.yes) {
				const label = title ? `"${title}" (${noteId})` : noteId
				const ok = await confirm(`Delete note ${label}? [y/N] `)
				if (!ok) throw new ClovaCliError("Aborted.", "ABORTED")
			}

			await client.deleteNote(noteId, workspaceId)
			const format = getOutputFormat(args)
			if (format === "json") printOutput({ noteId, deleted: true }, format)
			else console.info(`\x1b[32m✓\x1b[0m Deleted note ${title ? `"${title}" ` : ""}${noteId}`)
		} catch (error) {
			handleError(error)
		}
	}
})
