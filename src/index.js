const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Application state
// `cursor`: Represents the index of the currently selected/highlighted menu item
// `currentIndex`: Represents the index of the song currently being played
// `player`: Represents the active macOS afplay ChildProcess instance
// `paused`: Represents the playback pause state
let cursor = 0;
let currentIndex = 0;
let player = null;
let paused = false;

let songs = [];

// Path to the music directory
const musicDir = path.join(__dirname, '..', 'music');

// Check if the music directory exists
if (!fs.existsSync(musicDir)) {
  console.error(`Error: Music directory does not exist at "${musicDir}".`);
  process.exit(1);
}

// Function to clean up terminal state and exit
function cleanupAndExit() {
  if (player) {
    player.kill('SIGTERM');
    player = null;
  }
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  // Restore cursor visibility (\x1b[?25h) and leave alternate screen buffer (\x1b[?1049l)
  process.stdout.write("\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

// Function to play a song by its zero-based array index
function playSong(index) {
  // 1. Validate that the index is a valid array index before modifying player
  if (typeof index !== 'number' || Number.isNaN(index) || index < 0 || index >= songs.length) {
    return;
  }

  // 2. If an existing player process is running, stop it before starting another song
  if (player) {
    player.kill('SIGTERM');
    player = null;
  }

  // 3. Update playback state (currentIndex tracks playing song, cursor stays untouched)
  currentIndex = index;
  const songFileName = songs[currentIndex];
  const songPath = path.join(musicDir, songFileName);

  // 4. Start macOS afplay child process and keep a local reference
  const currentProcess = spawn('afplay', [songPath]);
  player = currentProcess;

  // 5. Reset paused state on new playback
  paused = false;

  // 6. Redraw menu to reflect playback status in place
  drawMenu();

  // 7. Handle child process close event safely
  currentProcess.on('close', (code) => {
    if (player === currentProcess) {
      player = null;
      drawMenu();
    }
  });

  // Handle potential errors when launching the child process
  currentProcess.on('error', (error) => {
    if (player === currentProcess) {
      player = null;
      drawMenu();
    }
  });
}

// Function to render the menu in place using ANSI escape sequences
function drawMenu() {
  // \x1b[H: Move cursor to home position (row 1, col 1)
  // \x1b[J: Clear from cursor to end of screen (prevents scroll artifacts)
  let output = "\x1b[H\x1b[J";

  output += "========== CLI MUSIC PLAYER ==========\n\n";

  songs.forEach((song, index) => {
    // Visually indicate the currently selected menu item with '>'
    if (index === cursor) {
      output += `> ${index + 1}. ${song}\n`;
    } else {
      output += `  ${index + 1}. ${song}\n`;
    }
  });

  // Display currently playing song status if player is active
  if (player) {
    const statusLabel = paused ? "[Paused]" : "[Playing]";
    output += `\nNow Playing: ${songs[currentIndex]} ${statusLabel}\n`;
  } else {
    output += `\nStatus: Stopped\n`;
  }

  output += "\n(UP/DOWN: Navigate | ENTER: Play | p: Pause/Resume | n: Next | b: Prev | q: Quit)\n";

  // Write the entire screen in one single call to prevent any flicker or extra lines
  process.stdout.write(output);
}

try {
  // Read all files from the music directory
  const files = fs.readdirSync(musicDir);

  // Filter for .mp3 files only
  songs = files.filter(file => path.extname(file).toLowerCase() === '.mp3');

  // Display menu or report if empty
  if (songs.length === 0) {
    console.log("No MP3 files found in the music directory.");
  } else {
    // Switch to alternate screen buffer (\x1b[?1049h) and hide terminal cursor (\x1b[?25l)
    // This creates a dedicated, stable screen viewport (like vim/htop) with no scroll jumps.
    process.stdout.write("\x1b[?1049h\x1b[?25l");

    // Initial draw of the menu
    drawMenu();

    // Enable raw mode:
    // In standard "cooked" mode, the terminal waits for Enter before sending input.
    // In "raw" mode, keypresses are sent immediately byte-by-byte without line buffering or echo.
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    // Resume reading from stdin stream
    process.stdin.resume();

    // Listen for data events on process.stdin.
    // `key` is a Node.js Buffer containing the raw binary byte(s) received from the terminal.
    process.stdin.on("data", (key) => {
      // 1. Detect 'q', 'Q', or Ctrl+C (3) to exit cleanly
      // 'q' is ASCII 113, 'Q' is ASCII 81, Ctrl+C is ASCII 3
      if (key[0] === 113 || key[0] === 81 || key[0] === 3) {
        cleanupAndExit();
        return;
      }

      // 2. Detect UP arrow (27 91 65)
      if (key[0] === 27 && key[1] === 91 && key[2] === 65) {
        if (cursor > 0) {
          cursor--;
          drawMenu();
        }
        return;
      }

      // 3. Detect DOWN arrow (27 91 66)
      if (key[0] === 27 && key[1] === 91 && key[2] === 66) {
        if (cursor < songs.length - 1) {
          cursor++;
          drawMenu();
        }
        return;
      }

      // 4. Detect ENTER key (byte value 13)
      if (key[0] === 13) {
        playSong(cursor);
        return;
      }

      // 5. Detect 'p' or 'P' (byte values 112 / 80) for Pause / Resume
      // Conceptual Signal Notes:
      // - SIGSTOP: Temporarily stops/freezes the OS process without terminating it.
      // - SIGCONT: Tells a stopped/frozen process to continue execution.
      // - SIGKILL: Forcefully terminates a process (cannot be used for pause).
      // Limitation:
      // SIGSTOP is an operating-system level process freeze rather than a dedicated
      // media-player pause API. Audio buffering and timing behavior depend on the OS and audio daemon.
      if (key[0] === 112 || key[0] === 80) {
        if (player) {
          if (!paused) {
            player.kill("SIGSTOP");
            paused = true;
            drawMenu();
          } else {
            player.kill("SIGCONT");
            paused = false;
            drawMenu();
          }
        }
        return;
      }

      // 6. Detect 'n' (byte value 110) for Next Track
      // Circular navigation calculation: (currentIndex + 1) % songs.length
      if (key[0] === 110) {
        if (songs.length > 0) {
          const nextIndex = (currentIndex + 1) % songs.length;
          cursor = nextIndex;
          playSong(nextIndex);
          drawMenu();
        }
        return;
      }

      // 7. Detect 'b' (byte value 98) for Previous Track
      // Circular navigation backwards calculation: (currentIndex - 1 + songs.length) % songs.length
      if (key[0] === 98) {
        if (songs.length > 0) {
          const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
          cursor = prevIndex;
          playSong(prevIndex);
          drawMenu();
        }
        return;
      }
    });

    // Handle OS interrupt signals for safe terminal restoration
    process.on('SIGINT', cleanupAndExit);
  }
} catch (error) {
  console.error(`Error reading music directory: ${error.message}`);
}











