import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Helper function to convert video to square/circle
function makeVideoSquare(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters('crop=min(iw\\,ih):min(iw\\,ih),scale=640:640,setsar=1')
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast', // Windows-safe preset
        '-c:a aac',
        '-t 59'
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}

// Paths
const inputVideo = path.join('videos', 'welcome.mp4');           
const outputVideo = path.join('output', 'welcome_circle.mp4');   

// Ensure output folder exists
if (!fs.existsSync('output')) fs.mkdirSync('output');

makeVideoSquare(inputVideo, outputVideo)
  .then(() => {
    console.log(`✅ Video converted to circle and saved as: ${outputVideo}`);
  })
  .catch(err => {
    console.error("❌ Conversion failed:", err);
  });
