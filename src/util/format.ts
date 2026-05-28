import type { Attendee, ScriptBlock } from "../types.ts"

function pad(n: number, w = 2): string {
	return String(n).padStart(w, "0")
}

/** Milliseconds → "mm:ss" or "h:mm:ss". */
export function msToClock(ms: number): string {
	const total = Math.floor(ms / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Milliseconds → "hh:mm:ss,mmm" (SRT). */
export function msToSrtTime(ms: number): string {
	const h = Math.floor(ms / 3600000)
	const m = Math.floor((ms % 3600000) / 60000)
	const s = Math.floor((ms % 60000) / 1000)
	const millis = ms % 1000
	return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`
}

/** Build a label → display-name map from the note's attendee list. */
export function speakerNameMap(attendees: Attendee[] | undefined): Map<string, string> {
	const map = new Map<string, string>()
	for (const a of attendees ?? []) {
		if (a.attendeeId) map.set(a.attendeeId, a.attendeeName)
	}
	return map
}

function speakerLabel(block: ScriptBlock, names: Map<string, string>): string {
	if (block.speakerId && names.has(block.speakerId)) return names.get(block.speakerId)!
	if (block.sttLabel) return `화자 ${block.sttLabel}`
	return "화자"
}

export interface TranscriptOptions {
	withTimestamps?: boolean
	withSpeakers?: boolean
}

/** Plain readable transcript: "[mm:ss] 화자 1: text". */
export function formatTranscript(blocks: ScriptBlock[], attendees: Attendee[] | undefined, opts: TranscriptOptions = {}): string {
	const names = speakerNameMap(attendees)
	const withTs = opts.withTimestamps ?? true
	const withSp = opts.withSpeakers ?? true
	const lines: string[] = []
	for (const b of blocks) {
		const parts: string[] = []
		if (withTs) parts.push(`[${msToClock(b.start)}]`)
		if (withSp) parts.push(`${speakerLabel(b, names)}:`)
		const prefix = parts.join(" ")
		const text = b.text.replace(/\n/g, " ").trim()
		lines.push(prefix ? `${prefix} ${text}` : text)
	}
	return lines.join("\n")
}

/** SRT subtitle export. */
export function formatSrt(blocks: ScriptBlock[]): string {
	return blocks.map((b, i) => `${i + 1}\n${msToSrtTime(b.start)} --> ${msToSrtTime(b.end)}\n${b.text.replace(/\n/g, " ").trim()}\n`).join("\n")
}
