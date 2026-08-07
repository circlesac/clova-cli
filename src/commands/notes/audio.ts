import { writeFile } from "node:fs/promises"
import { commonArgs, noteArg } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { ClovaCliError, handleError } from "../../lib/errors.ts"
import { accountArg, noteContext } from "./context.ts"

function extFor(contentType: string): string {
	if (contentType.includes("mp4") || contentType.includes("m4a") || contentType.includes("aac")) return "m4a"
	if (contentType.includes("wav")) return "wav"
	if (contentType.includes("ogg")) return "ogg"
	return "mp3"
}

export const audioCommand = defineLeafCommand({
	meta: {
		name: "audio",
		description: "Download the note's merged audio recording"
	},
	args: {
		...noteArg,
		...commonArgs,
		...accountArg,
		output: { type: "string", description: "Output file path", alias: "o" }
	},
	async run({ args }) {
		try {
			const { client, noteId, workspaceId } = await noteContext(args)
			const audio = await client.getMergedAudio(noteId, workspaceId)
			if (!audio) throw new ClovaCliError("This note has no audio recording.", "NO_AUDIO")

			const out = args.output ?? `${noteId}.${extFor(audio.contentType)}`
			await writeFile(out, Buffer.from(audio.data))
			const kb = Math.round(audio.data.byteLength / 1024)
			console.info(`\x1b[32m✓\x1b[0m Saved audio (${kb} KB) → ${out}`)
		} catch (error) {
			handleError(error)
		}
	}
})
