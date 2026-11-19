import { FFmpeg } from "@ffmpeg/ffmpeg";

const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

let ffmpeg;
let ffmpegLoad;

async function getFFmpeg() {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!ffmpegLoad) {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    ffmpegLoad = ffmpeg.load({
      coreURL: new URL("ffmpeg/ffmpeg-core.js", baseUrl).href,
      wasmURL: new URL("ffmpeg/ffmpeg-core.wasm", baseUrl).href,
    }).catch((error) => {
      ffmpegLoad = null;
      throw new Error(`The video converter could not load: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  await ffmpegLoad;
  return ffmpeg;
}

export async function transcodeVideoToMp4(file, onProgress = () => {}) {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose a video smaller than 500 MB so it can be processed in your browser.");
  }

  onProgress(0);
  const engine = await getFFmpeg();
  const suffix = crypto.randomUUID();
  const inputPath = `source-${suffix}`;
  const outputPath = `optimized-${suffix}.mp4`;
  const progressListener = ({ progress }) => {
    if (Number.isFinite(progress)) onProgress(Math.max(0, Math.min(progress, 1)));
  };
  let inputWritten = false;
  let outputWritten = false;

  engine.on("progress", progressListener);
  try {
    await engine.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));
    inputWritten = true;

    for (const crf of [28, 30]) {
      await engine.exec([
        "-i", inputPath,
        "-vf", "scale=w='if(gte(iw,ih),min(1920,iw),-2)':h='if(gte(iw,ih),-2,min(1920,ih))':force_divisible_by=2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", String(crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputPath,
      ]);
      outputWritten = true;

      const output = await engine.readFile(outputPath);
      const optimized = new File([output], file.name.replace(/\.[^.]+$/, ".mp4"), {
        type: "video/mp4",
      });
      if (optimized.size <= MAX_UPLOAD_BYTES) return optimized;

      await engine.deleteFile(outputPath);
      outputWritten = false;
      if (crf === 30) {
        throw new Error("The optimized video is still over 50 MB. Choose a shorter clip to fit the storage limit.");
      }
    }

    throw new Error("The video could not be compressed to a supported size.");
  } finally {
    engine.off("progress", progressListener);
    if (inputWritten) await engine.deleteFile(inputPath);
    if (outputWritten) await engine.deleteFile(outputPath);
  }
}
