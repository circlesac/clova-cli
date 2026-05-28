import { ClovaClient } from "../../api/client.ts"
import { getAccount } from "../../lib/credentials.ts"
import { ClovaCliError } from "../../lib/errors.ts"
import { resolveNote } from "../../util/resolve.ts"

export interface NoteContext {
	client: ClovaClient
	noteId: string
	workspaceId: string
}

export async function noteContext(args: { note?: string; workspace?: string; account?: string }): Promise<NoteContext> {
	if (!args.note) throw new ClovaCliError("Missing note reference (note ID or URL).", "MISSING_NOTE")
	const creds = await getAccount(args.account)
	const client = new ClovaClient(creds)
	const resolved = resolveNote(args.note)
	const workspaceId = args.workspace ?? resolved.workspaceId ?? creds.workspaceId!
	return { client, noteId: resolved.noteId, workspaceId }
}

export const accountArg = {
	account: { type: "string" as const, description: "Account name (when multiple are configured)" }
}
