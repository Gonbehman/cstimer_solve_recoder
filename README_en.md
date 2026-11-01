# csTimer Solve Recorder

**English** | [日本語](README.ja.md)

A Chrome extension that records your webcam in sync with [csTimer](https://cstimer.net/) and automatically saves **only the solves you want to keep**: fast ones, new bests, or ones you pick manually.

## Features

- **Automatic recording**: Recording starts when you press Space and stops when the timer stops.
- **Pre-roll**: Each video includes 3–4 seconds of footage from before you pressed Space. You can change this length.
- **Save conditions**: A solve is saved if any one of these is true:
  - It is a new session best (`_BEST` is added to the filename)
  - It is at or under your time threshold
  - You force-saved it (`_force` is added to the filename)
- **Force save**: Use the on-screen button or `Option`/`Alt` + `S`.
  - Press it while recording to mark the current solve for saving.
  - Press it after a solve to save the previous unsaved video (kept for 60 seconds by default).
- **Save folder**: Videos are saved to a subfolder of your Downloads folder (default: `cstimer_rec`).
- **Preview**: A small preview appears in the top-right corner. You can show or hide it and change its width from the popup.
- `+2` penalties are included in the time, and DNF solves are marked in the filename.

Example filename: `cstimer_2026-11-01_155243_12.34s_#1122_BEST.mp4`

## Requirements

- Google Chrome 111 or later (desktop)
- A webcam
- Tested on macOS with Chrome

## Installation

1. Download and extract this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Open or reload csTimer and allow camera access.
6. When the preview shows "待機中 v0.5.0" ("Ready") in its top-left corner, setup is complete.

> If Chrome's **"Ask where to save each file before downloading"** setting is on, a save dialog will appear for every video. Turn it off.

## Usage

1. Use csTimer as usual.
2. Videos are saved automatically when a save condition is met.
3. To keep a solve that doesn't meet any condition, use force save.
4. To cancel a recording, press `Esc` while recording.

## Settings

Click the extension icon to open the settings.

| Setting | Default | Description |
|---|---|---|
| Show preview | On | Shows the camera preview (recording works even when hidden) |
| Width | 240px | Preview width (80–800px, applied immediately) |
| Session best | On | Save if the solve is the fastest in the current session |
| Threshold | On | Save if the solve is at or under the threshold |
| Threshold (seconds) | 30 | The time limit for threshold saving |
| Save folder | `cstimer_rec` | Path inside your Downloads folder (e.g. `cube/3x3`). Leave empty to save directly to Downloads |
| Pre-roll seconds | 3 | Set to 0 to turn off pre-roll |
| Post-roll seconds | 1.5 | How long to keep recording after the timer stops |
| Hold unsaved video | 60s | How long you can still force-save the previous solve |

> The settings screen is currently in Japanese only.

## How it works

- The extension detects that the timer has stopped when a new solve appears in csTimer's records. It only reads csTimer's data. It never writes, changes, or deletes your records.
- For pre-roll, the extension starts a new short recording every second while idle, so it uses a little CPU even when you are not solving.
- All video processing happens in your browser. Nothing is sent anywhere.

## Limitations

- Only the Space key starts recording. Touch input and Stackmat timers are not supported.
- If you false-start, that recording is combined with your next solve.
- If csTimer is set to ask for confirmation before saving a time, the video is not saved until you confirm.
- Only the most recent unsaved video is kept for force saving.
- Changes to csTimer's internals may break the extension.
- Videos are saved as MP4, or as WebM if MP4 recording is not supported.

## License

[MIT License](LICENSE)

## Disclaimer

This is an unofficial extension and is not affiliated with csTimer or its developers.
