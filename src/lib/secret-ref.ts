import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { AuthError } from "./errors.ts"

const execFileAsync = promisify(execFile)

// A secret reference points at a value held in an external secrets manager instead of
// being passed in plaintext. Only the 1Password-compatible `op://vault/item/field` form
// is recognised; it is resolved with the Circles Vault CLI (`vlt read`). Anything that
// does not look like a reference is returned untouched, so non-vault users are unaffected.
const SECRET_REF = /^op:\/\//

export function isSecretRef(value: string): boolean {
	return SECRET_REF.test(value.trim())
}

// Resolve a single value: if it is an `op://` reference, fetch it via `vlt read`;
// otherwise return it unchanged. Undefined passes through.
export async function resolveSecretRef(value: string | undefined): Promise<string | undefined> {
	if (!value || !isSecretRef(value)) return value
	const ref = value.trim()
	try {
		const { stdout } = await execFileAsync("vlt", ["read", "--no-newline", ref])
		const resolved = stdout.trim()
		if (!resolved) throw new AuthError(`Secret reference "${ref}" resolved to an empty value.`)
		return resolved
	} catch (error) {
		if (error instanceof AuthError) throw error
		const detail = error instanceof Error ? error.message : String(error)
		throw new AuthError(
			`Failed to resolve secret reference "${ref}" via vlt.\n` + "  Make sure the Circles Vault CLI (vlt) is installed and you are logged in.\n" + `  ${detail}`
		)
	}
}
