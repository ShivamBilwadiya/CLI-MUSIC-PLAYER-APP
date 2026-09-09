# 🎵 CLI Music Player

A lightweight, zero-dependency, terminal-based MP3 music player built with **Node.js** using native Unix process signals, raw terminal I/O streams, and in-place ANSI screen rendering.

---

## 📸 Interface Preview

```text
╔══════════════════════════════════════════════════════╗
║                   CLI MUSIC PLAYER                   ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║     > 1. Interstellar-Theme.mp3                      ║
║       2. Eminem - Rap God.mp3                        ║
║       3. Nadaan Parindey.mp3                         ║
║       4. Hookah Bar.mp3                              ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║ ▶ Now Playing: Interstellar-Theme.mp3 [Playing]      ║
║                                                      ║
║   [████████████░░░░░░░░] 60% (1:20 / 2:13)           ║
║                                                      ║
║ ↑↓ Navigate   Enter Play    p Pause/Resume           ║
║ n Next        b Previous    q / Ctrl+C Exit          ║
╚══════════════════════════════════════════════════════╝
```

---

## ✨ Features

- **🔍 Automatic MP3 Discovery**: Automatically scans and indexes all `.mp3` audio files located in the `music/` directory.
- **🧭 Interactive Terminal Menu**: Arrow-key navigation (<kbd>↑</kbd> / <kbd>↓</kbd>) with bounded cursor highlighting.
- **⏯️ Full Playback Controls**: Play (<kbd>Enter</kbd>), Pause & Resume (<kbd>p</kbd>), Next track (<kbd>n</kbd>), and Previous track (<kbd>b</kbd>).
- **⏱️ Real-Time Progress Tracking**: 1-second interval timer rendering dynamic progress bars (`[████░░░░] 50%`) with formatted elapsed and total duration timestamps (`mm:ss`).
- **🔄 Seamless Track Progression**: Uses child-process exit detection to automatically advance to the next track upon natural song completion.
- **⚡ Zero External Dependencies**: Powered purely by Node.js built-in core modules (`fs`, `path`, `child_process`).
- **🖥️ Flicker-Free ANSI Screen Rendering**: Uses the terminal alternate screen buffer (`\x1b[?1049h`) and in-place cursor repositioning (`\x1b[H`) to eliminate screen flash and terminal scrollback flood.
- **🛡️ Robust Process & Signal Management**:
  - Unix process pausing and resuming using `SIGSTOP` and `SIGCONT`.
  - ChildProcess identity guards preventing stale events from interfering with active tracks.
  - Async request tokens (`playRequestId`) protecting against rapid track-switching race conditions.
  - Safe terminal teardown restoring raw mode, cursor visibility, and standard shell buffers on exit.

---

## 🎮 Keyboard Controls

| Key | Action | Description |
| :--- | :--- | :--- |
| <kbd>↑</kbd> | **Navigate Up** | Move the selection cursor up the playlist |
| <kbd>↓</kbd> | **Navigate Down** | Move the selection cursor down the playlist |
| <kbd>Enter</kbd> | **Play Song** | Start playing the currently selected track |
| <kbd>p</kbd> | **Pause / Resume** | Toggle pause (`SIGSTOP`) and resume (`SIGCONT`) on the playing audio |
| <kbd>n</kbd> | **Next Track** | Advance to the next track in circular order |
| <kbd>b</kbd> | **Previous Track** | Jump to the previous track in circular order |
| <kbd>q</kbd> or <kbd>Ctrl+C</kbd> | **Quit** | Stop all audio processes, clean up timers, restore terminal, and exit |

---

## 🛠️ Prerequisites

- **Operating System**: macOS (uses native `afplay` and `afinfo` system audio tools)
- **Node.js**: v14.0.0 or higher

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/ShivamBilwadiya/CLI-MUSIC-PLAYER-APP.git
cd CLI-MUSIC-PLAYER-APP
```

### 2. Add Your MP3 Files
Place your favorite `.mp3` audio files into the `music/` directory:
```bash
cp /path/to/your/songs/*.mp3 ./music/
```

### 3. Launch the Player
Start the application using npm or node:
```bash
npm start
# or
node src/index.js
```

---

## 📂 Project Structure

```text
CLI-MUSIC-PLAYER-APP/
├── music/               # Audio directory (place your .mp3 files here)
│   └── .gitkeep
├── src/
│   └── index.js         # Main application logic and terminal UI renderer
├── package.json         # Project metadata and start scripts
└── README.md            # Project documentation
```

---

## 🧠 Architecture & Data Flow

```text
1. Filesystem
   │  (reads files on disk via fs.readdirSync)
   ▼
2. findSongs()
   │  (filters and validates .mp3 files)
   ▼
3. songs array
   │  (holds indexed list of song filenames)
   ▼
4. Terminal Menu
   │  (drawMenu() renders playlist box using cursor for `> ` marker)
   ▼
5. Raw Keyboard Buffer
   │  (process.stdin in raw mode emits binary keypress chunks)
   ▼
6. handleKey()
   │  (decodes ASCII/escape bytes: UP, DOWN, ENTER, p, n, b, q)
   ▼
7. Application State
   │  (updates cursor, currentIndex, paused, timeElapsed, musicDuration)
   ▼
8. playSong()
   │  (stops previous player, resets elapsed time, fetches duration via afinfo)
   ▼
9. spawn()
   │  (launches macOS native audio player)
   ▼
10. afplay ChildProcess
    │  (holds active OS subprocess in `player`)
    ▼
11. Audio Output
    │  (streams decoded audio frames to speakers)
    ▼
12. ChildProcess Events
    │  ('close' event fires on track completion with process identity check)
    ▼
13. Progress State
    │  (1-second interval timer increments `timeElapsed` while playing)
    ▼
14. ANSI Terminal Rendering
       (renderUI() rewrites screen in place using \x1b[H without scrolling)
```

---

