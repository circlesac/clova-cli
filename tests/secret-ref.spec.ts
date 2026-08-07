import { describe, expect, it } from "vitest"
import { isSecretRef, resolveSecretRef } from "../src/lib/secret-ref.ts"

describe("isSecretRef", () => {
	it("recognises op:// references", () => {
		expect(isSecretRef("op://personal/example-service/password")).toBe(true)
		expect(isSecretRef("  op://vault/item/field  ")).toBe(true)
	})

	it("rejects plain values and other schemes", () => {
		expect(isSecretRef("hunter2")).toBe(false)
		expect(isSecretRef("NID_AUT=abc; NID_SES=def")).toBe(false)
		expect(isSecretRef("vlt://github.com/circlesac#TOKEN")).toBe(false)
	})
})

describe("resolveSecretRef", () => {
	it("passes plaintext through untouched (no vlt call)", async () => {
		await expect(resolveSecretRef("hunter2")).resolves.toBe("hunter2")
	})

	it("passes undefined through", async () => {
		await expect(resolveSecretRef(undefined)).resolves.toBeUndefined()
	})
})
