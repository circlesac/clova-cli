import { describe, expect, it } from "vitest"
import { ClovaCliError } from "../src/lib/errors.ts"
import { resolveNote } from "../src/util/resolve.ts"

describe("resolveNote", () => {
	it("accepts a bare note ID", () => {
		expect(resolveNote("e2fadfc7-0a68-473a-88fc-b411cd105c53n")).toEqual({
			noteId: "e2fadfc7-0a68-473a-88fc-b411cd105c53n"
		})
	})

	it("parses a note-detail URL into workspace + note", () => {
		expect(resolveNote("https://clovanote.naver.com/w/GLKwtSvqGp6EFi3m6fWw/note-detail/e2fadfc7-0a68-473a-88fc-b411cd105c53n")).toEqual({
			workspaceId: "GLKwtSvqGp6EFi3m6fWw",
			noteId: "e2fadfc7-0a68-473a-88fc-b411cd105c53n"
		})
	})

	it("rejects share URLs with a helpful error", () => {
		expect(() => resolveNote("https://clovanote.naver.com/s/KijNdhBDgKG4a2E8gopv3MS")).toThrow(ClovaCliError)
	})

	it("rejects garbage input", () => {
		expect(() => resolveNote("not a note!")).toThrow(ClovaCliError)
	})
})
