import { ClovaCliError } from "../lib/errors.ts"

export interface ResolvedNote {
	noteId: string
	workspaceId?: string
}

/**
 * Resolve a note reference from raw input. Accepts:
 *  - a bare note ID
 *  - a note-detail URL (https://clovanote.naver.com/w/{ws}/note-detail/{noteId})
 * Share URLs (/s/{key}) are resolved server-side by the web app and have no public
 * API endpoint, so they cannot be resolved here — the user must open the link once
 * (while logged in) and pass the resulting note-detail URL or note ID.
 */
export function resolveNote(input: string): ResolvedNote {
	const trimmed = input.trim()

	const detail = trimmed.match(/clovanote\.naver\.com\/w\/([^/]+)\/note-detail\/([^/?#]+)/)
	if (detail) {
		return { workspaceId: detail[1], noteId: detail[2]! }
	}

	if (/clovanote\.naver\.com\/s\//.test(trimmed)) {
		throw new ClovaCliError(
			"Share URLs (/s/...) can't be resolved directly. Open the link once while logged in, then pass the note-detail URL (…/note-detail/<id>) or the note ID.",
			"UNRESOLVABLE_SHARE_URL"
		)
	}

	// Treat anything else as a bare note ID.
	if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
		return { noteId: trimmed }
	}

	throw new ClovaCliError(`Could not parse note reference: ${input}`, "BAD_NOTE_REF")
}
