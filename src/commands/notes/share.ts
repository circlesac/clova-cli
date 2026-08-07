import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { accountArg, noteContext } from "./context.ts"

export const shareCommand = defineLeafCommand({
	meta: {
		name: "share",
		description: "Show the note's share link, password, and access settings"
	},
	args: { ...noteArg, ...commonArgs, ...accountArg },
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const share = await client.getSharedNotes(noteId, workspaceId)
			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(share, format)
				return
			}
			printOutput(
				{
					sharedId: share.sharedId,
					url: share.sharedLinkUrl,
					accessType: share.accessType,
					passwordEnabled: share.enablePassword,
					password: share.enablePassword ? share.password : "",
					sharedUsers: share.sharedUserList?.length ?? 0
				},
				format
			)
		} catch (error) {
			handleError(error)
		}
	}
})
