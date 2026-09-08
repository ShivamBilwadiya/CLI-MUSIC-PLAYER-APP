const fs = require('fs');
const path = require('path');

console.log("CLI Music Player has started successfully.\n");

// Path to the music directory
const musicDir = path.join(__dirname, '..', 'music');

// Check if the music directory exists
if (!fs.existsSync(musicDir)) {
  console.error(`Error: Music directory does not exist at "${musicDir}".`);
  process.exit(1);
}

try {
  // Read all files from the music directory
  const files = fs.readdirSync(musicDir);

  // Filter for .mp3 files only
  const mp3Files = files.filter(file => path.extname(file).toLowerCase() === '.mp3');

  // Report results
  if (mp3Files.length === 0) {
    console.log("No MP3 files found in the music directory.");
  } else {
    console.log(`Found ${mp3Files.length} MP3 file(s):`);
    mp3Files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  }
} catch (error) {
  console.error(`Error reading music directory: ${error.message}`);
}
