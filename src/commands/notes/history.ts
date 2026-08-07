import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { accountArg, noteContext } from "./context.ts"

export const historyCommand = defineLeafCommand({
	meta: {
		name: "history",
		description: "List who has opened the shared note"
	},
	args: { ...noteArg, ...commonArgs, ...accountArg },
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const share = await client.getSharedNotes(noteId, workspaceId)
			if (!share.sharedId) throw new ClovaCliError("This note is not shared.", "NOT_SHARED")

			const history = await client.getShareHistory(noteId, share.sharedId, workspaceId)
			const users = history.sharedNoteAccessUserList ?? []
			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(users, format)
				return
			}
			printOutput(
				users.map((u) => ({ name: u.name, email: u.email })),
				format,
				[
					{ key: "name", label: "Name" },
					{ key: "email", label: "Email" }
				]
			)
		} catch (error) {
			handleError(error)
		}
	}
})
