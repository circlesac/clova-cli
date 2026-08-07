import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { handleError } from "../../lib/errors.ts"
import type { SummaryItem } from "../../types.ts"
import { accountArg, noteContext } from "./context.ts"

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

// Each by-speaker entry's shape isn't documented; pull the most likely name + body
// fields and degrade to a single-line dump rather than a multi-line JSON blob.
function formatSpeaker(s: Record<string, unknown>): string {
	const name = str(s.speakerName) || str(s.name) || str(s.attendeeName) || str(s.sttLabel) || "화자"
	let body = str(s.summary) || str(s.updatedText) || str(s.text)
	if (!body) {
		const list = s.summaryList ?? s.contents ?? s.textList
		if (Array.isArray(list)) {
			body = list.map((x) => (str((x as SummaryItem)?.updatedText) || str((x as SummaryItem)?.text) || str(x))).filter(Boolean).join(" / ")
		}
	}
	return `- ${name}: ${body || JSON.stringify(s)}`
}

export const summaryCommand = defineLeafCommand({
	meta: {
		name: "summary",
		description: "Show the AI summary (brief, agenda, tasks, by-speaker)"
	},
	args: { ...noteArg, ...commonArgs, ...accountArg },
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const note = await client.getNote(noteId, workspaceId)
			const ann = note.annotation ?? {}

			if (args.json) {
				console.info(JSON.stringify(ann, null, 2))
				return
			}

			// The summary sections wrap their items in a list field and always carry
			// timestamp keys, so emptiness must be judged by the inner list — not the
			// wrapper object — otherwise empty summaries print as raw JSON.
			const out: string[] = []

			const brief = str(ann.summaryBrief?.updatedText) || str(ann.summaryBrief?.text)
			if (brief) out.push(bold("요약"), brief)

			const agenda = ann.summaryAgenda?.agendaList ?? []
			if (agenda.length) {
				out.push("\n" + bold("주요 안건"))
				for (const a of agenda) out.push(`- ${str(a.updatedText) || str(a.text)}`)
			}

			const tasks = ann.summaryRecommendedTask?.recommendedTaskList ?? []
			if (tasks.length) {
				out.push("\n" + bold("추천 할 일"))
				for (const t of tasks) out.push(`- ${str(t.updatedText) || str(t.text)}`)
			}

			const speakers = ann.summaryBySpeaker?.speakerSummaryList ?? []
			if (speakers.length) {
				out.push("\n" + bold("화자별 요약"))
				for (const s of speakers) out.push(formatSpeaker(s))
			}

			if (out.length === 0) {
				console.info("No AI summary has been generated for this note yet.")
				return
			}
			console.info(out.join("\n"))
		} catch (error) {
			handleError(error)
		}
	}
})
