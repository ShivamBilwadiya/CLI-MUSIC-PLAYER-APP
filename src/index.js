const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

// Application state
// `cursor` represents the index of the currently selected/highlighted menu item in the songs list.
// (In future milestones, `cursor` handles menu selection, while a separate `currentIndex` will track the playing song).
let cursor = 0;
let songs = [];
let player = null;

// Path to the music directory
const musicDir = path.join(__dirname, '..', 'music');

// Check if the music directory exists
if (!fs.existsSync(musicDir)) {
  console.error(`Error: Music directory does not exist at "${musicDir}".`);
  process.exit(1);
}

// Function to select and play a song by its zero-based array index
function playSong(index) {
  // Validate that index is a valid number within array bounds
  if (!Number.isNaN(index) && index >= 0 && index < songs.length) {
    cursor = index;
    const selectedSong = songs[cursor];
    const songPath = path.join(musicDir, selectedSong);

    console.log(`\nNow Playing: ${selectedSong}`);

    // Spawn macOS afplay child process to play the audio file
    player = spawn('afplay', [songPath]);

    // Print the child process PID when available
    if (player.pid) {
      console.log(`Audio playback started with Process ID (PID): ${player.pid}`);
    }

    // Handle the child process exit event when playback finishes or stops
    player.on('exit', (code) => {
      console.log(`\nPlayback ended for: ${selectedSong} (Process exited with code ${code})`);
      player = null;
    });

    // Handle potential errors when launching the child process
    player.on('error', (error) => {
      console.error(`\nFailed to start playback: ${error.message}`);
      player = null;
    });
  } else {
    console.log(`\nInvalid song selection. Please enter a number between 1 and ${songs.length}.`);
  }
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

    // Create readline interface for terminal input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Prompt user to enter song number
    rl.question('\nEnter song number to play: ', (input) => {
      const selectedNumber = parseInt(input.trim(), 10);
      // Convert 1-based user input to 0-based array index
      const zeroBasedIndex = selectedNumber - 1;

      playSong(zeroBasedIndex);
      rl.close();
    });
  }
} catch (error) {
  console.error(`Error reading music directory: ${error.message}`);
}




