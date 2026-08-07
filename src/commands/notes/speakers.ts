import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { accountArg, noteContext } from "./context.ts"

export const speakersCommand = defineLeafCommand({
	meta: {
		name: "speakers",
		description: "List the note's speakers / attendees"
	},
	args: { ...noteArg, ...commonArgs, ...accountArg },
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const note = await client.getNote(noteId, workspaceId)
			const attendees = note.noteInfo.attendeeList ?? []
			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(attendees, format)
				return
			}
			printOutput(
				attendees.map((a) => ({ name: a.attendeeName, type: a.attendeeType ?? "", id: a.attendeeId })),
				format,
				[
					{ key: "name", label: "Name" },
					{ key: "type", label: "Type" },
					{ key: "id", label: "Attendee ID" }
				]
			)
		} catch (error) {
			handleError(error)
		}
	}
})
