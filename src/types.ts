export type OutputFormat = "table" | "json" | "plain"

export interface ClovaConfig {
	outputFormat?: OutputFormat
}

export interface Credentials {
	name: string
	cookie: string
	deviceId: string
	eUserId?: string
	email?: string
	userName?: string
	workspaceId?: string
	sessionId?: string
}

export interface Workspace {
	workspaceId: string
	workspaceType: string
	ownerEUserId: string
	name: string
	numberOfMember?: number
}

export interface User {
	eUserId: string
	userName: string
	email: string
	snsCode: string
	workspaces: Workspace[]
}

export interface Attendee {
	attendeeId: string
	attendeeName: string
	profileImageUrl?: string
	attendeeType?: string
	eUserId?: string
}

export interface AlignmentWord {
	word: string
	postfix: string
	start: number
	end: number
}

export interface ScriptBlock {
	blockId: string
	start: number
	end: number
	sttLabel: string
	speakerId: string
	text: string
	alignment?: AlignmentWord[]
	translatedText?: string
}

export interface SummaryItem {
	text?: string
	updatedText?: string
	feedback?: string
}

export interface NoteAnnotation {
	preMemo?: { text: string }
	postMemo?: { text: string }
	memoList?: Array<{ text: string; start?: number; blockId?: string }>
	summaryBrief?: { text: string; updatedText?: string }
	summaryAgenda?: { agendaList?: SummaryItem[] }
	summaryRecommendedTask?: { recommendedTaskList?: SummaryItem[] }
	summaryBySpeaker?: { speakerSummaryList?: Array<Record<string, unknown>> }
	summaryList?: unknown[]
}

export interface NoteContents {
	noteId: string
	noteInfo: {
		noteId: string
		noteName?: string
		folderId?: string
		folderName?: string
		noteStatus?: string
		createdDate?: string
		updatedDate?: string
		attendeeList?: Attendee[]
		notePermission?: Record<string, { enabled: boolean }>
	}
	script?: { blockList: ScriptBlock[] }
	annotation?: NoteAnnotation
	permission?: { permissionType: string }
}

export interface NoteListItem {
	noteId: string
	noteName?: string
	folderId?: string
	folderName?: string
	noteStatus?: string
	createdDate?: string
	updatedDate?: string
	audioDuration?: number
}

export interface SharedNote {
	sharedId: string
	sharedLinkUrl: string
	enablePassword: boolean
	password: string
	accessType: string
	sharedUserList: unknown[]
}

export interface ApiResponse<T> {
	code: number
	message: string
	contents: T
}
