import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

function makeVideoCircle(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // 🔹 Make it square and simulate circular appearance
      .videoFilters([
        "crop=min(iw\\,ih):min(iw\\,ih)",
        "scale=640:640",
        "setsar=1",
        // optional: add border for circle-like preview
        "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.3:t=20"
      ])
      .outputOptions([
        "-c:v libx264",
        "-preset medium",
        "-b:v 800k",
        "-c:a aac",
        "-b:a 96k",
        "-t 59",
        "-pix_fmt yuv420p"
      ])
      .save(outputPath)
      .on("end", () => {
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ Converted successfully (${sizeMB} MB): ${outputPath}`);
        if (sizeMB > 12) {
          console.warn("⚠️ Video still exceeds 12MB limit for Telegram video note!");
        }
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("❌ Conversion failed:", err.message);
        reject(err);
      });
  });
}

const inputVideo = path.join("videos", "welcome.mp4");
const outputVideo = path.join("output", "welcome_circle.mp4");

// Ensure output folder exists
if (!fs.existsSync("output")) fs.mkdirSync("output");

makeVideoCircle(inputVideo, outputVideo)
  .then(() => {
    console.log("🎥 Circle-style video ready to send!");
  })
  .catch((err) => console.error("❌ Error:", err));
