import { storeCredentials } from "../lib/credentials.ts"
import { ApiError, AuthError } from "../lib/errors.ts"
import type { ApiResponse, Credentials, NoteContents, NoteListItem, SharedNote, User } from "../types.ts"

const API_HOST = "https://api-v2.clovanote.naver.com"
const ORIGIN = "https://clovanote.naver.com"
const CLIENT_TYPE = "WEB"
const CLIENT_VERSION = "3.38.1"

// API codes that mean the device session is invalid and must be recreated.
const SESSION_ERROR_CODES = new Set([4011000, 4011006])

interface RequestOptions {
	method?: string
	body?: unknown
	query?: Record<string, string>
	raw?: boolean
	skipSession?: boolean
}

export class ClovaClient {
	private creds: Credentials

	constructor(creds: Credentials) {
		this.creds = creds
	}

	get workspaceId(): string {
		const ws = this.creds.workspaceId
		if (!ws) throw new AuthError("No workspace configured. Run: clova auth login")
		return ws
	}

	private headers(extra?: Record<string, string>): Record<string, string> {
		const h: Record<string, string> = {
			"note-client-type": CLIENT_TYPE,
			"note-client-version": CLIENT_VERSION,
			"note-device-id": this.creds.deviceId,
			Origin: ORIGIN,
			Cookie: this.creds.cookie,
			...extra
		}
		if (this.creds.sessionId) h["note-session-id"] = this.creds.sessionId
		return h
	}

	private async raw(path: string, opts: RequestOptions = {}): Promise<Response> {
		const url = new URL(API_HOST + path)
		if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v)
		const headers = this.headers()
		if (opts.body !== undefined) headers["Content-Type"] = "application/json"
		return fetch(url, {
			method: opts.method ?? "GET",
			headers,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
		})
	}

	/** Fetch a parsed API response, recreating the device session once on session errors. */
	private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
		if (!opts.skipSession && !this.creds.sessionId) await this.ensureSession()

		let res = await this.raw(path, opts)
		if (res.status === 401 && !opts.skipSession) {
			// Could be an expired NAVER login or a dead device session. Try recreating the session once.
			await this.createSession()
			res = await this.raw(path, opts)
		}

		if (res.status === 401) {
			throw new AuthError("NAVER session expired or invalid. Run: clova auth login")
		}

		const text = await res.text()
		let parsed: ApiResponse<T> | undefined
		try {
			parsed = JSON.parse(text) as ApiResponse<T>
		} catch {
			throw new ApiError(`Unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}`, res.status)
		}

		if (parsed.code !== 0) {
			if (SESSION_ERROR_CODES.has(parsed.code) && !opts.skipSession) {
				await this.createSession()
				return this.request<T>(path, { ...opts, skipSession: true })
			}
			throw new ApiError(`${parsed.message} (code ${parsed.code})`, res.status, parsed.code)
		}
		return parsed.contents
	}

	async getUser(): Promise<User> {
		return this.request<User>("/v2/user", { skipSession: true })
	}

	async createSession(): Promise<string> {
		const body = {
			deviceId: this.creds.deviceId,
			deviceName: "clova-cli",
			force: true,
			loginDate: new Date().toISOString(),
			pushToken: "",
			pushType: "FCM-WEB",
			appType: "CLOVA_NOTE_WEB",
			userData: { additionalProp1: {} }
		}
		const contents = await this.request<{ currentSessionId: string }>(`/v2/w/${this.workspaceId}/sessions`, {
			method: "POST",
			body,
			skipSession: true
		})
		this.creds.sessionId = contents.currentSessionId
		await storeCredentials(this.creds)
		return contents.currentSessionId
	}

	async ensureSession(): Promise<void> {
		if (!this.creds.sessionId) await this.createSession()
	}

	/** The most recent notes, as shown on the web home screen (newest first, ~10). */
	async listRecentNotes(workspaceId?: string): Promise<NoteListItem[]> {
		const contents = await this.request<{ homeRecentNoteList?: NoteListItem[] }>(`/v2/w/${workspaceId ?? this.workspaceId}/home/notes`)
		return contents.homeRecentNoteList ?? []
	}

	/** Notes whose recording falls within [startDate, endDate] (ISO 8601 UTC). */
	async listNotesByDate(startDate: string, endDate: string, workspaceId?: string): Promise<NoteListItem[]> {
		const contents = await this.request<{ calendarNoteList?: NoteListItem[] }>(`/v2/w/${workspaceId ?? this.workspaceId}/home/notes/calendar`, {
			query: { startDate, endDate }
		})
		return contents.calendarNoteList ?? []
	}

	async getNote(noteId: string, workspaceId?: string): Promise<NoteContents> {
		return this.request<NoteContents>(`/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}`)
	}

	async deleteNote(noteId: string, workspaceId?: string): Promise<void> {
		await this.request(`/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}`, { method: "DELETE" })
	}

	async renameNote(noteId: string, name: string, workspaceId?: string): Promise<void> {
		await this.request(`/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}/info/name`, {
			method: "PUT",
			body: { noteName: name }
		})
	}

	/**
	 * Trade a share key (/s/{shareKey}) for the underlying note. Called against your own
	 * workspace; the request authorizes your session to read the note, then returns the
	 * note ID and the owner's workspace. Read the note via your own workspace afterwards.
	 */
	async resolveShareKey(shareKey: string): Promise<{ noteId: string; workspaceId: string; nonce: string }> {
		return this.request(`/v2/w/${this.workspaceId}/shared-notes/${shareKey}/authorization`)
	}

	async getSharedNotes(noteId: string, workspaceId?: string): Promise<SharedNote> {
		return this.request<SharedNote>(`/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}/shared-notes`)
	}

	async getShareHistory(noteId: string, shareKey: string, workspaceId?: string): Promise<{ sharedNoteAccessUserList: Array<{ name: string; email: string }> }> {
		return this.request(`/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}/shared-notes/${shareKey}/users/history`)
	}

	async getFolders(workspaceId?: string): Promise<{ myFolders: Array<{ folderId: string; folderName: string; newNoteCnt: number }> }> {
		return this.request(`/v2/w/${workspaceId ?? this.workspaceId}/folders`)
	}

	/** Download merged audio as bytes. Returns null when the note has no audio. */
	async getMergedAudio(noteId: string, workspaceId?: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
		if (!this.creds.sessionId) await this.ensureSession()
		const path = `/v2/w/${workspaceId ?? this.workspaceId}/notes/${noteId}/merged-audio`
		let res = await this.raw(path)
		if (res.status === 401) {
			await this.createSession()
			res = await this.raw(path)
		}
		if (res.status === 404) return null
		if (!res.ok && res.status !== 206) {
			throw new ApiError(`Failed to download audio (HTTP ${res.status})`, res.status)
		}
		return { data: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "audio/mpeg" }
	}
}
