import { ClovaCliError } from "../lib/errors.ts"

export interface ResolvedNote {
	noteId?: string
	workspaceId?: string
	shareKey?: string
}

/**
 * Resolve a note reference from raw input. Accepts:
 *  - a bare note ID
 *  - a note-detail URL (https://clovanote.naver.com/w/{ws}/note-detail/{noteId})
 *  - a share URL (https://clovanote.naver.com/s/{shareKey}) → returns the share key,
 *    which the client trades for a note ID via the shared-notes authorization endpoint.
 */
export function resolveNote(input: string): ResolvedNote {
	const trimmed = input.trim()

	const detail = trimmed.match(/clovanote\.naver\.com\/w\/([^/]+)\/note-detail\/([^/?#]+)/)
	if (detail) {
		return { workspaceId: detail[1], noteId: detail[2]! }
	}

	const share = trimmed.match(/clovanote\.naver\.com\/s\/([^/?#]+)/)
	if (share) {
		return { shareKey: share[1]! }
	}

	// Treat anything else as a bare note ID.
	if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
		return { noteId: trimmed }
	}

	throw new ClovaCliError(`Could not parse note reference: ${input}`, "BAD_NOTE_REF")
}
