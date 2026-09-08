const fs = require('fs');
const path = require('path');

// Application state
// `cursor` represents the index of the currently selected/highlighted menu item in the songs list.
// (In future milestones, `cursor` handles menu selection, while a separate `currentIndex` will track the playing song).
let cursor = 0;
let songs = [];

// Path to the music directory
const musicDir = path.join(__dirname, '..', 'music');

// Check if the music directory exists
if (!fs.existsSync(musicDir)) {
  console.error(`Error: Music directory does not exist at "${musicDir}".`);
  process.exit(1);
}

// Function to select a song by its zero-based array index
function selectSong(index) {
  // Validate that index is within valid array bounds
  if (index >= 0 && index < songs.length) {
    cursor = index;
    console.log(`\nSelected song: ${songs[cursor]}`);
  } else {
    console.log(`\nInvalid song index: ${index}. Please select a valid song.`);
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

    // Temporary test selection for Milestone 4
    selectSong(1);
  }
} catch (error) {
  console.error(`Error reading music directory: ${error.message}`);
}


