import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { formatSrt, formatTranscript } from "../../util/format.ts"
import { accountArg, noteContext } from "./context.ts"

export const transcriptCommand = defineLeafCommand({
	meta: {
		name: "transcript",
		description: "Print the full transcript (speaker + timestamp + text)"
	},
	args: {
		...noteArg,
		...commonArgs,
		...accountArg,
		srt: { type: "boolean", description: "Output as SRT subtitles" },
		"no-timestamps": { type: "boolean", description: "Hide timestamps" },
		"no-speakers": { type: "boolean", description: "Hide speaker labels" }
	},
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const note = await client.getNote(noteId, workspaceId)
			const blocks = note.script?.blockList ?? []
			if (blocks.length === 0) throw new ClovaCliError("This note has no transcript.", "NO_TRANSCRIPT")

			if (args.json) {
				console.info(JSON.stringify(blocks, null, 2))
				return
			}
			if (args.srt) {
				console.info(formatSrt(blocks))
				return
			}
			console.info(
				formatTranscript(blocks, note.noteInfo.attendeeList, {
					withTimestamps: !args["no-timestamps"],
					withSpeakers: !args["no-speakers"]
				})
			)
		} catch (error) {
			handleError(error)
		}
	}
})
