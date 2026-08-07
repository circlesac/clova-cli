import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { msToClock } from "../../util/format.ts"
import { accountArg, noteContext } from "./context.ts"

export const getCommand = defineLeafCommand({
	meta: {
		name: "get",
		description: "Show note metadata (title, status, speakers, counts)"
	},
	args: { ...noteArg, ...commonArgs, ...accountArg },
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const note = await client.getNote(noteId, workspaceId)
			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(note, format)
				return
			}

			const blocks = note.script?.blockList ?? []
			const lastEnd = blocks.length ? blocks[blocks.length - 1]!.end : 0
			printOutput(
				{
					noteId: note.noteId,
					title: note.noteInfo.noteName ?? "",
					status: note.noteInfo.noteStatus ?? "",
					folder: note.noteInfo.folderName ?? "",
					created: note.noteInfo.createdDate ?? "",
					updated: note.noteInfo.updatedDate ?? "",
					duration: lastEnd ? msToClock(lastEnd) : "",
					segments: blocks.length,
					speakers: (note.noteInfo.attendeeList ?? []).map((a) => a.attendeeName).join(", ")
				},
				format
			)
		} catch (error) {
			handleError(error)
		}
	}
})
