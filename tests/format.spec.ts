import { describe, expect, it } from "vitest"
import type { ScriptBlock } from "../src/types.ts"
import { formatSrt, formatTranscript, msToClock, msToSrtTime, speakerNameMap } from "../src/util/format.ts"

describe("msToClock", () => {
	it("formats sub-hour as mm:ss", () => {
		expect(msToClock(0)).toBe("00:00")
		expect(msToClock(32885)).toBe("00:32")
		expect(msToClock(630000)).toBe("10:30")
	})
	it("formats hours as h:mm:ss", () => {
		expect(msToClock(3661000)).toBe("1:01:01")
	})
})

describe("msToSrtTime", () => {
	it("formats hh:mm:ss,mmm", () => {
		expect(msToSrtTime(0)).toBe("00:00:00,000")
		expect(msToSrtTime(32885)).toBe("00:00:32,885")
		expect(msToSrtTime(3661234)).toBe("01:01:01,234")
	})
})

const blocks: ScriptBlock[] = [
	{ blockId: "a", start: 0, end: 2000, sttLabel: "1", speakerId: "", text: "안녕하세요\n반갑습니다" },
	{ blockId: "b", start: 2000, end: 4000, sttLabel: "2", speakerId: "spk-2", text: "네 반가워요" }
]

describe("speakerNameMap", () => {
	it("maps attendeeId to name", () => {
		const m = speakerNameMap([{ attendeeId: "spk-2", attendeeName: "오현아" }])
		expect(m.get("spk-2")).toBe("오현아")
	})
})

describe("formatTranscript", () => {
	it("renders timestamp + speaker + flattened text", () => {
		const out = formatTranscript(blocks, [{ attendeeId: "spk-2", attendeeName: "오현아" }])
		expect(out).toContain("[00:00] 화자 1: 안녕하세요 반갑습니다")
		expect(out).toContain("[00:02] 오현아: 네 반가워요")
	})
	it("honors no-timestamps and no-speakers", () => {
		const out = formatTranscript(blocks, undefined, { withTimestamps: false, withSpeakers: false })
		expect(out.split("\n")[0]).toBe("안녕하세요 반갑습니다")
	})
})

describe("formatSrt", () => {
	it("numbers cues with srt timestamps", () => {
		const out = formatSrt(blocks)
		expect(out).toContain("1\n00:00:00,000 --> 00:00:02,000\n안녕하세요 반갑습니다")
		expect(out).toContain("2\n00:00:02,000 --> 00:00:04,000\n네 반가워요")
	})
})
