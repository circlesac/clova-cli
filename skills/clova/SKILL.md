---
name: clova
description: Use the clova CLI to read CLOVA Note notes — transcripts, AI summaries, speakers, audio, and share info from the terminal
user-invocable: true
---

`clova` is a CLI for [CLOVA Note](https://clovanote.naver.com). It authenticates with NAVER login
cookies and reads notes (transcript, summary, speakers, audio, share settings) from the
`api-v2.clovanote.naver.com` backend.

## Prerequisites

Authenticate first (one-time), either way:

```bash
# A. Automated — drives a headless browser (needs Playwright + Chrome installed).
#    NAVER may show a CAPTCHA; re-run with --headed to solve it once.
clova auth login --id <NAVER_ID>            # prompts for password (or --pw / CLOVA_NAVER_PW)

# B. Paste cookies from the browser (devtools → Application → Cookies → naver.com).
clova auth login --aut "<NID_AUT>" --ses "<NID_SES>"
```

Check status: `clova auth status` · Log out: `clova auth logout`

Credentials are stored at `~/.config/clova/credentials/`. The CLI creates its own device session
automatically and recreates it when it expires.

## Note reference

Every `note` subcommand takes a note ID or a note-detail URL
(`https://clovanote.naver.com/w/<ws>/note-detail/<id>`) as the first positional argument.

Share URLs (`/s/<key>`) cannot be resolved by the CLI (the web app resolves them server-side).
Open the share link once while logged in and use the note-detail URL or note ID instead.

## Commands

```bash
# Metadata: title, status, duration, speakers, segment count
clova note get <note>

# Transcript — "[mm:ss] 화자 N: text"
clova note transcript <note>
clova note transcript <note> --srt            # SRT subtitles
clova note transcript <note> --no-timestamps  # plain text, no times
clova note transcript <note> --no-speakers    # hide speaker labels
clova note transcript <note> --json           # raw blocks (start/end/sttLabel/text/alignment)

# AI summary (brief, agenda, recommended tasks, by-speaker)
clova note summary <note>

# Speakers / attendees
clova note speakers <note>

# Download merged audio (audio/mp4 → .m4a)
clova note audio <note> -o meeting.m4a

# Share settings: link, password, access type
clova note share <note>

# Access history: who opened the shared note
clova note history <note>
```

## Output formats

All read commands support `--json` (structured) and `--plain` (tab-separated); default is a table.
Use `--json` when you need to parse results programmatically — e.g. piping a transcript into
another tool, or extracting summary text.

## Multiple accounts

If more than one account is configured, pass `--account <name>` (the name is the local-part of the
NAVER email). Use `--workspace <id>` to target a non-default workspace.
