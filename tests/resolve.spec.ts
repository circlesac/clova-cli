import { describe, expect, it } from "vitest"
import { ClovaCliError } from "../src/lib/errors.ts"
import { resolveNote } from "../src/util/resolve.ts"

describe("resolveNote", () => {
	it("accepts a bare note ID", () => {
		expect(resolveNote("abcdef01-2345-6789-abcd-ef0123456789n")).toEqual({
			noteId: "abcdef01-2345-6789-abcd-ef0123456789n"
		})
	})

	it("parses a note-detail URL into workspace + note", () => {
		expect(resolveNote("https://clovanote.naver.com/w/EXAMPLEworkspace1234/note-detail/abcdef01-2345-6789-abcd-ef0123456789n")).toEqual({
			workspaceId: "EXAMPLEworkspace1234",
			noteId: "abcdef01-2345-6789-abcd-ef0123456789n"
		})
	})

	it("parses a share URL into a share key", () => {
		expect(resolveNote("https://clovanote.naver.com/s/EXAMPLEshareKey0000000")).toEqual({
			shareKey: "EXAMPLEshareKey0000000"
		})
	})

	it("rejects garbage input", () => {
		expect(() => resolveNote("not a note!")).toThrow(ClovaCliError)
	})
})
