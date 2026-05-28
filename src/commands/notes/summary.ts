import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { handleError } from "../../lib/errors.ts"
import { accountArg, noteContext } from "./context.ts"

function nonEmpty(v: unknown): boolean {
	if (v == null) return false
	if (typeof v === "string") return v.trim().length > 0
	if (Array.isArray(v)) return v.length > 0
	if (typeof v === "object") return Object.keys(v).length > 0
	return true
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

			const brief = ann.summaryBrief?.updatedText || ann.summaryBrief?.text || ""
			const out: string[] = []
			if (brief.trim()) {
				out.push("\x1b[1m요약\x1b[0m")
				out.push(brief.trim())
			}
			if (nonEmpty(ann.summaryAgenda)) {
				out.push("\n\x1b[1m주요 안건\x1b[0m")
				out.push(typeof ann.summaryAgenda === "string" ? ann.summaryAgenda : JSON.stringify(ann.summaryAgenda, null, 2))
			}
			if (nonEmpty(ann.summaryRecommendedTask)) {
				out.push("\n\x1b[1m추천 할 일\x1b[0m")
				out.push(typeof ann.summaryRecommendedTask === "string" ? ann.summaryRecommendedTask : JSON.stringify(ann.summaryRecommendedTask, null, 2))
			}
			if (nonEmpty(ann.summaryBySpeaker)) {
				out.push("\n\x1b[1m화자별 요약\x1b[0m")
				out.push(JSON.stringify(ann.summaryBySpeaker, null, 2))
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
