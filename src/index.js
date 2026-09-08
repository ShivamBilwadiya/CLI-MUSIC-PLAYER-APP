const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

// Function to play a song by its zero-based array index
function playSong(index) {
  // 1 & 2. Validate that the index is a valid array index before modifying player
  if (typeof index !== 'number' || Number.isNaN(index) || index < 0 || index >= songs.length) {
    console.log(`\nInvalid song selection. Please enter a number between 1 and ${songs.length}.`);
    return;
  }

  // 3. If an existing player process is running, stop it before starting another song
  if (player) {
    player.kill();
    player = null;
  }

  // 4 & 5. Update playback state and retrieve song filename
  cursor = index;
  currentIndex = index;
  const songFileName = songs[currentIndex];

  // 6. Construct the complete song path using path.join()
  const songPath = path.join(musicDir, songFileName);

  // 7 & 8. Start macOS afplay child process and store in player
  player = spawn('afplay', [songPath]);

  // 9. Reset paused state on new playback
  paused = false;

  // 10. Print playing information and PID for debugging
  console.log(`\nNow Playing: ${songFileName}`);
  if (player.pid) {
    console.log(`Playback process started (PID: ${player.pid})`);
  }

  // 11. Handle the child process close event when playback completes or ends
  player.on('close', (code) => {
    console.log(`\nPlayback ended for: ${songFileName} (Process closed with code ${code})`);
    player = null;
  });

  // Handle potential errors when launching the child process
  player.on('error', (error) => {
    console.error(`\nPlayback process error: ${error.message}`);
    player = null;
  });
}

// Function to handle continuous terminal input without exiting
function startInteractiveLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function promptUser() {
    rl.question('\nEnter song number to play (or "q" to quit): ', (input) => {
      const trimmed = input.trim().toLowerCase();

      if (trimmed === 'q' || trimmed === 'exit') {
        if (player) {
          player.kill();
          player = null;
        }
        console.log('Exiting CLI Music Player. Goodbye!');
        rl.close();
        return;
      }

      const selectedNumber = parseInt(trimmed, 10);
      // Convert 1-based user input to 0-based array index
      const zeroBasedIndex = selectedNumber - 1;

      playSong(zeroBasedIndex);

      // Prompt again for another input without ending the process
      promptUser();
    });
  }

  promptUser();
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
    console.log("========== CLI MUSIC PLAYER ==========\n");
    songs.forEach((song, index) => {
      console.log(`${index + 1}. ${song}`);
    });

    // Start interactive continuous input loop
    startInteractiveLoop();
  }
} catch (error) {
  console.error(`Error reading music directory: ${error.message}`);
}







