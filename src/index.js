/**
 * CLI MUSIC PLAYER
 * -----------------------------------------------------------------------------
 * A lightweight, terminal-based MP3 music player built with Node.js
 * using Unix process signals, raw terminal I/O, and ANSI screen rendering.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// =============================================================================
// 1. CONFIGURATION
// =============================================================================
const CONFIG = {
  musicDir: path.join(__dirname, '..', 'music'),
  boxWidth: 54,
  progressBarWidth: 20,
  timerIntervalMs: 1000
};

// =============================================================================
// 2. SONG DISCOVERY
// =============================================================================

/**
 * Discovers and returns all .mp3 files located in the music directory.
 * Validates directory existence and handles missing folders gracefully.
 */
function findSongs() {
  if (!fs.existsSync(CONFIG.musicDir) || !fs.statSync(CONFIG.musicDir).isDirectory()) {
    console.error(`Error: Music directory does not exist or is not a directory at "${CONFIG.musicDir}".`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONFIG.musicDir);
  return files.filter(file => path.extname(file).toLowerCase() === '.mp3');
}

// =============================================================================
// 3. APPLICATION STATE
// =============================================================================
let songs = [];
let cursor = 0;           // Index of currently highlighted menu item
let currentIndex = 0;     // Index of song currently being played
let player = null;        // Active afplay ChildProcess instance
let paused = false;       // Playback pause state (SIGSTOP / SIGCONT)
let musicDuration = 0;    // Total duration in seconds of currently playing song
let timeElapsed = 0;      // Elapsed playback time in seconds
let progressTimer = null; // setInterval reference for elapsed time
let playRequestId = 0;    // Incremental request token preventing async race conditions

// =============================================================================
// 4. PLAYBACK
// =============================================================================

/**
 * Plays a song by its zero-based array index in the songs array.
 * Responsible for stopping previous playback, fetching duration,
 * spawning afplay, updating state, and setting up process exit listeners.
 */
async function playSong(index) {
  if (typeof index !== 'number' || Number.isNaN(index) || index < 0 || index >= songs.length) {
    return;
  }

  // Assign a unique request ID to guard against rapid consecutive clicks
  const currentRequestId = ++playRequestId;

  // Stop previous playback and timers
  stopPlayer();

  currentIndex = index;
  timeElapsed = 0;
  const songFileName = songs[currentIndex];
  const songPath = path.join(CONFIG.musicDir, songFileName);

  if (!fs.existsSync(songPath)) {
    renderUI();
    return;
  }

  // Obtain song duration asynchronously using afinfo
  const duration = await getSongDuration(songPath);

  // If another track was requested while waiting for duration, discard this one
  if (currentRequestId !== playRequestId) {
    return;
  }

  musicDuration = duration;

  // Spawn macOS afplay child process
  const currentProcess = spawn('afplay', [songPath]);
  player = currentProcess;
  paused = false;
  startProgress(musicDuration);
  renderUI();

  // Handle process completion safely with process identity check
  currentProcess.on('close', (code, signal) => {
    // Process Identity Check: discard stale events from old processes
    if (player !== currentProcess) {
      return;
    }

    player = null;
    stopProgress();
    paused = false;
    timeElapsed = 0;
    musicDuration = 0;

    // Natural completion (code === 0, no termination signal) -> auto-play next track
    if (code === 0 && !signal && songs.length > 0) {
      nextSong();
    } else {
      renderUI();
    }
  });

  currentProcess.on('error', () => {
    if (player === currentProcess) {
      player = null;
      stopProgress();
      paused = false;
      timeElapsed = 0;
      musicDuration = 0;
      renderUI();
    }
  });
}

/**
 * Advances to the next track using circular modulo navigation.
 */
function nextSong() {
  if (songs.length === 0) return;
  const nextIndex = (currentIndex + 1) % songs.length;
  cursor = nextIndex;
  playSong(nextIndex);
}

/**
 * Moves to the previous track using circular modulo navigation.
 */
function previousSong() {
  if (songs.length === 0) return;
  const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
  cursor = prevIndex;
  playSong(prevIndex);
}

// =============================================================================
// 5. PROCESS MANAGEMENT
// =============================================================================

/**
 * Intentionally terminates the active audio player process and clears timers.
 * Sets player = null prior to sending SIGKILL to invalidate stale close events.
 */
function stopPlayer() {
  if (player !== null) {
    const oldPlayer = player;
    player = null; // Removed from state before killing to discard old close events
    try {
      oldPlayer.kill('SIGKILL');
    } catch (err) {
      // Ignore if process already exited
    }
  }
  stopProgress();
}

/**
 * Retrieves the audio duration in seconds using macOS external `afinfo`.
 * Returns a Promise that resolves to the numeric duration in seconds.
 */
function getSongDuration(songPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(songPath)) {
      resolve(0);
      return;
    }

    const infoProcess = spawn('afinfo', [songPath]);
    let output = '';

    infoProcess.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    infoProcess.on('close', (code) => {
      if (code === 0) {
        const match = output.match(/estimated duration:\s*([\d.]+)\s*sec/i);
        if (match && match[1]) {
          const duration = parseFloat(match[1]);
          resolve(duration);
          return;
        }
      }
      resolve(0);
    });

    infoProcess.on('error', () => {
      resolve(0);
    });
  });
}

// =============================================================================
// 6. PAUSE / RESUME
// =============================================================================

/**
 * Pauses playback by sending SIGSTOP Unix signal to the afplay process.
 */
function pausePlayer() {
  if (player && !paused) {
    player.kill('SIGSTOP');
    paused = true;
    renderUI();
  }
}

/**
 * Resumes playback by sending SIGCONT Unix signal to the afplay process.
 */
function resumePlayer() {
  if (player && paused) {
    player.kill('SIGCONT');
    paused = false;
    renderUI();
  }
}

/**
 * Toggles pause/resume state on the active audio player.
 */
function togglePause() {
  if (!player) return;
  if (!paused) {
    pausePlayer();
  } else {
    resumePlayer();
  }
}

// =============================================================================
// 7. PROGRESS
// =============================================================================

/**
 * Formats a duration in seconds into standard mm:ss notation.
 */
function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Generates a discrete text-based progress bar string using '█' and '░'.
 */
function createProgressBar(duration, elapsed, musicbarWidth = CONFIG.progressBarWidth) {
  if (!duration || duration <= 0) {
    return '░'.repeat(musicbarWidth);
  }

  const pct = Math.min(Math.max(elapsed / duration, 0), 1);
  const filled = Math.floor(pct * musicbarWidth);
  const empty = musicbarWidth - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Starts a 1-second interval timer to increment timeElapsed and refresh the UI.
 */
function startProgress(duration) {
  stopProgress();
  if (duration !== undefined && duration > 0) {
    musicDuration = duration;
  }
  progressTimer = setInterval(() => {
    if (player && !paused) {
      if (timeElapsed < musicDuration) {
        timeElapsed++;
        renderUI();
      }
    }
  }, CONFIG.timerIntervalMs);
}

/**
 * Stops and clears the 1-second progress timer.
 */
function stopProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

// =============================================================================
// 8. MENU / TERMINAL RENDERING
// =============================================================================

function formatBoxLine(content = '') {
  const maxContentLen = CONFIG.boxWidth - 2;
  const trimmed = content.length > maxContentLen ? content.slice(0, maxContentLen - 3) + '...' : content;
  return '║ ' + trimmed.padEnd(maxContentLen, ' ') + ' ║\n';
}

function centerText(text, width) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

/**
 * Renders the header title and numbered song list with cursor indicator.
 */
function drawMenu() {
  let output = '';
  output += '╔' + '═'.repeat(CONFIG.boxWidth) + '╗\n';
  output += formatBoxLine(centerText('CLI MUSIC PLAYER', CONFIG.boxWidth - 2));
  output += '╠' + '═'.repeat(CONFIG.boxWidth) + '╣\n';
  output += formatBoxLine('');

  songs.forEach((song, index) => {
    const marker = index === cursor ? '> ' : '  ';
    const line = `  ${marker}${index + 1}. ${song}`;
    output += formatBoxLine(line);
  });

  output += formatBoxLine('');
  process.stdout.write(output);
}

/**
 * Displays currently playing track and play/pause status.
 */
function drawNowPlaying() {
  let output = '';
  output += '╠' + '═'.repeat(CONFIG.boxWidth) + '╣\n';

  if (player) {
    const icon = paused ? '⏸' : '▶';
    const statusLabel = paused ? '[Paused]' : '[Playing]';
    const playingSong = songs[currentIndex] || 'Unknown';
    output += formatBoxLine(`${icon} Now Playing: ${playingSong} ${statusLabel}`);
  } else {
    output += formatBoxLine('■ Status: Stopped');
  }

  output += formatBoxLine('');
  process.stdout.write(output);
}

/**
 * Renders the text-based progress bar and duration metrics.
 */
function drawProgress() {
  let output = '';
  const progressBar = createProgressBar(musicDuration, timeElapsed, CONFIG.progressBarWidth);
  const pct = musicDuration > 0 ? Math.min(100, Math.floor((timeElapsed / musicDuration) * 100)) : 0;

  if (player) {
    output += formatBoxLine(`  [${progressBar}] ${pct}% (${formatTime(timeElapsed)} / ${formatTime(musicDuration)})`);
  } else {
    output += formatBoxLine(`  [${progressBar}] 0%`);
  }

  output += formatBoxLine('');
  process.stdout.write(output);
}

/**
 * Displays keyboard navigation and action shortcuts.
 */
function drawControls() {
  let output = '';
  output += formatBoxLine('↑↓ Navigate   Enter Play    p Pause/Resume');
  output += formatBoxLine('n Next        b Previous    q / Ctrl+C Exit');
  output += '╚' + '═'.repeat(CONFIG.boxWidth) + '╝\n';
  process.stdout.write(output);
}

/**
 * Coordinates in-place terminal repainting by moving the cursor to home (\x1b[H)
 * and invoking all sub-rendering functions.
 */
function renderUI() {
  // \x1b[H: Move cursor to home position (row 1, column 1)
  process.stdout.write('\x1b[H');
  drawMenu();
  drawNowPlaying();
  drawProgress();
  drawControls();
}

// =============================================================================
// 9. KEYBOARD INPUT
// =============================================================================

/**
 * Translates raw keyboard input byte-by-byte into application actions.
 */
function handleKey(key) {
  // 1. Detect 'q', 'Q', or Ctrl+C (byte value 3) to exit cleanly
  if (key[0] === 113 || key[0] === 81 || key[0] === 3) {
    cleanup();
    return;
  }

  // 2. Detect UP arrow (27 91 65)
  if (key[0] === 27 && key[1] === 91 && key[2] === 65) {
    if (cursor > 0) {
      cursor--;
      renderUI();
    }
    return;
  }

  // 3. Detect DOWN arrow (27 91 66)
  if (key[0] === 27 && key[1] === 91 && key[2] === 66) {
    if (cursor < songs.length - 1) {
      cursor++;
      renderUI();
    }
    return;
  }

  // 4. Detect ENTER key (byte value 13)
  if (key[0] === 13) {
    playSong(cursor);
    return;
  }

  // 5. Detect 'p' or 'P' (byte values 112 / 80) for Pause / Resume
  if (key[0] === 112 || key[0] === 80) {
    togglePause();
    return;
  }

  // 6. Detect 'n' (byte value 110) for Next Track
  if (key[0] === 110) {
    nextSong();
    return;
  }

  // 7. Detect 'b' (byte value 98) for Previous Track
  if (key[0] === 98) {
    previousSong();
    return;
  }
}

// =============================================================================
// 10. CLEANUP
// =============================================================================

/**
 * Performs graceful terminal and process cleanup upon application exit.
 */
function cleanup() {
  stopPlayer();
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  // Restore cursor visibility (\x1b[?25h) and leave alternate screen buffer (\x1b[?1049l)
  process.stdout.write('\x1b[?25h\x1b[?1049l');
  process.exit(0);
}

// =============================================================================
// 11. APPLICATION STARTUP
// =============================================================================

/**
 * Initializes application startup, discovers songs, enables raw terminal mode,
 * and attaches key and process listeners.
 */
function init() {
  songs = findSongs();

  if (songs.length === 0) {
    console.log('No MP3 files found in the music directory.');
    return;
  }

  // Switch to alternate screen buffer (\x1b[?1049h), hide cursor (\x1b[?25l),
  // clear screen (\x1b[2J), and place cursor at home (\x1b[H)
  process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H');
  renderUI();

  // Enable raw mode for immediate byte-by-byte keypress handling
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  process.stdin.on('data', handleKey);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Start application
init();
