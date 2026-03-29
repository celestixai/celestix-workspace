import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_DIR = '/tmp/libreoffice';

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Convert a file to another format using LibreOffice.
 * E.g., convertFile(buffer, 'doc.docx', 'pdf') → PDF buffer
 */
export async function convertFile(inputBuffer: Buffer, inputName: string, outputFormat: string): Promise<Buffer> {
  ensureTempDir();
  const uniqueName = `${Date.now()}-${inputName}`;
  const inputPath = path.join(TEMP_DIR, uniqueName);
  fs.writeFileSync(inputPath, inputBuffer);

  try {
    execSync(
      `libreoffice --headless --convert-to ${outputFormat} --outdir ${TEMP_DIR} "${inputPath}"`,
      { timeout: 60000 },
    );

    const baseName = path.basename(uniqueName, path.extname(uniqueName));
    const outputPath = path.join(TEMP_DIR, `${baseName}.${outputFormat}`);
    const outputBuffer = fs.readFileSync(outputPath);

    // Cleanup
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}

    return outputBuffer;
  } catch (err) {
    try { fs.unlinkSync(inputPath); } catch {}
    throw err;
  }
}

/**
 * Trim a video using ffmpeg.
 * startTime and endTime in format "HH:MM:SS" or seconds.
 */
export async function trimVideo(inputBuffer: Buffer, startTime: string, endTime: string): Promise<Buffer> {
  ensureTempDir();
  const inputPath = path.join(TEMP_DIR, `${Date.now()}-input.mp4`);
  const outputPath = path.join(TEMP_DIR, `${Date.now()}-output.mp4`);

  fs.writeFileSync(inputPath, inputBuffer);

  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -ss ${startTime} -to ${endTime} -c copy "${outputPath}"`,
      { timeout: 120000 },
    );

    const result = fs.readFileSync(outputPath);

    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}

    return result;
  } catch (err) {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
    throw err;
  }
}
