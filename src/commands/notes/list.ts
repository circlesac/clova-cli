import { ClovaClient } from "../../api/client.ts"
import { commonArgs } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { getAccount } from "../../lib/credentials.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"
import { formatDateTime, msToClock } from "../../util/format.ts"
import { accountArg } from "./context.ts"

/** Accept "YYYY-MM-DD" (interpreted in local time) or any Date-parseable string → ISO 8601 UTC. */
function toIso(value: string, endOfDay: boolean): string {
	const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}` : value
	const d = new Date(dateOnly)
	if (Number.isNaN(d.getTime())) throw new ClovaCliError(`Invalid date: ${value}`, "BAD_DATE")
	return d.toISOString()
}

export const listCommand = defineLeafCommand({
	meta: {
		name: "list",
		description: "List recent notes, or notes within a date range (--from/--to)"
	},
	args: {
		...commonArgs,
		...accountArg,
		from: { type: "string" as const, description: "Start date (YYYY-MM-DD) — switches to a date-range listing" },
		to: { type: "string" as const, description: "End date (YYYY-MM-DD), defaults to now (used with --from)" },
		limit: { type: "string" as const, description: "Maximum number of notes to show" }
	},
	async run({ args }) {
		try {
			const creds = await getAccount(args.account)
			const client = new ClovaClient(creds)
			const workspaceId = args.workspace ?? creds.workspaceId!

			let notes
			if (args.from || args.to) {
				const start = toIso(args.from ?? "1970-01-01", false)
				const end = args.to ? toIso(args.to, true) : new Date().toISOString()
				notes = await client.listNotesByDate(start, end, workspaceId)
			} else {
				notes = await client.listRecentNotes(workspaceId)
			}

			// Newest first; ISO 8601 strings sort lexically by time.
			notes = [...notes].sort((a, b) => (b.createdDate ?? "").localeCompare(a.createdDate ?? ""))
			const limit = args.limit ? Number(args.limit) : undefined
			if (limit && limit > 0) notes = notes.slice(0, limit)

			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(notes, format)
				return
			}

			const rows = notes.map((n) => ({
				created: formatDateTime(n.createdDate),
				status: n.noteStatus ?? "",
				duration: n.audioDuration ? msToClock(n.audioDuration) : "",
				title: n.noteName || "(untitled)",
				noteId: n.noteId
			}))
			printOutput(rows, format, [
				{ key: "created", label: "created" },
				{ key: "status", label: "status" },
				{ key: "duration", label: "dur" },
				{ key: "title", label: "title", width: 40 },
				{ key: "noteId", label: "noteId" }
			])
		} catch (error) {
			handleError(error)
		}
	}
})
