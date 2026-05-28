import { defineCommand } from "citty"
import { audioCommand } from "./audio.ts"
import { getCommand } from "./get.ts"
import { historyCommand } from "./history.ts"
import { shareCommand } from "./share.ts"
import { speakersCommand } from "./speakers.ts"
import { summaryCommand } from "./summary.ts"
import { transcriptCommand } from "./transcript.ts"

export const noteCommand = defineCommand({
	meta: {
		name: "note",
		description: "Read CLOVA Note notes — transcript, summary, speakers, audio, share"
	},
	subCommands: {
		get: getCommand,
		transcript: transcriptCommand,
		summary: summaryCommand,
		speakers: speakersCommand,
		audio: audioCommand,
		share: shareCommand,
		history: historyCommand
	}
})
