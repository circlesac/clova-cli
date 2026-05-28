# clova

CLOVA Note CLI — pull transcripts, summaries, speakers, and audio from [CLOVA Note](https://clovanote.naver.com) right in your terminal.

## Install

```bash
# Homebrew
brew install circlesac/tap/clova

# npm
npm install -g clova

# or standalone
curl -fsSL https://github.com/circlesac/clova-cli/releases/latest/download/install.sh | sh
```

## Authenticate

CLOVA Note requires a NAVER login session. Grab your NAVER cookies and hand them to `clova`:

1. Log in to <https://clovanote.naver.com> in your browser.
2. Open devtools → **Application → Cookies → `https://naver.com`**.
3. Copy the values of **`NID_AUT`** and **`NID_SES`**.

```bash
clova auth login --aut "<NID_AUT>" --ses "<NID_SES>"
# or paste the whole cookie string:
clova auth login --cookie "NID_AUT=...; NID_SES=..."
# or via env / stdin:
CLOVA_COOKIE="NID_AUT=...; NID_SES=..." clova auth login
pbpaste | clova auth login --stdin
```

`clova` stores credentials under `~/.config/clova/credentials/` and creates its own device
session (separate from your browser). Check it with `clova auth status`.

## Usage

All `note` commands accept a **note ID** or a **note-detail URL**
(`https://clovanote.naver.com/w/<ws>/note-detail/<id>`):

```bash
# Metadata: title, status, duration, speakers, segment count
clova note get <note>

# Full transcript ([mm:ss] speaker: text)
clova note transcript <note>
clova note transcript <note> --srt           # SRT subtitles
clova note transcript <note> --no-timestamps  # plain text
clova note transcript <note> --json           # raw transcript blocks

# AI summary (brief / agenda / tasks / by-speaker)
clova note summary <note>

# Speakers / attendees
clova note speakers <note>

# Download the merged audio recording
clova note audio <note> -o meeting.m4a

# Share settings (link, password, access type)
clova note share <note>

# Who has opened the shared note
clova note history <note>
```

Every read command supports `--json` and `--plain` output.

### Share links

Share URLs (`https://clovanote.naver.com/s/<key>`) are resolved server-side by the CLOVA Note
web app and have no public API endpoint. To work with a shared note, open the link once while
logged in, then copy the resulting note-detail URL (or the note ID) and pass that to `clova`.

## Development

```bash
bun install
bun run dev note get <note>   # run from source
bun run test                  # vitest
bun run build                 # compile a standalone binary to dist/clova
```

Releases are automated via GitHub Actions (`gh workflow run release.yml`) — see `CLAUDE.md`.
