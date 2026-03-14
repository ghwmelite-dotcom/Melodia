import type { Env } from "../types.js";
import type { SongBlueprint } from "./blueprint.service.js";
import type { MusicResult } from "./music.service.js";
import type { ArtworkResult } from "./artwork.service.js";
import { songQueries } from "../db/queries.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LyricsSection = {
  section: string;
  lines: string[];
};

// ---------------------------------------------------------------------------
// Lyrics parsing
// ---------------------------------------------------------------------------

/**
 * Split raw lyrics text into structured sections.
 * Section markers look like: [Verse 1], [Chorus], [Bridge], etc.
 */
function parseLyricsStructure(lyrics: string): LyricsSection[] {
  const sectionPattern = /^\[([^\]]+)\]/;
  const rawLines = lyrics.split("\n");

  const sections: LyricsSection[] = [];
  let currentSection: LyricsSection | null = null;

  for (const line of rawLines) {
    const trimmed = line.trim();
    const match = trimmed.match(sectionPattern);

    if (match) {
      // Start a new section
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { section: match[1], lines: [] };
    } else if (currentSection) {
      // Only add non-empty lines inside a section
      if (trimmed.length > 0) {
        currentSection.lines.push(trimmed);
      }
    }
    // Lines before the first marker are ignored (could be blank lines)
  }

  // Push the last section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

// ---------------------------------------------------------------------------
// WAV header parsing
// ---------------------------------------------------------------------------

type WavHeader = {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataSize: number; // bytes in the data chunk
};

function parseWavHeader(headerBytes: Uint8Array): WavHeader {
  if (headerBytes.length < 44) {
    throw new Error("WAV header too short");
  }

  const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);

  // Verify RIFF
  const riff = String.fromCharCode(
    headerBytes[0], headerBytes[1], headerBytes[2], headerBytes[3]
  );
  const wave = String.fromCharCode(
    headerBytes[8], headerBytes[9], headerBytes[10], headerBytes[11]
  );
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Not a valid WAV file");
  }

  const numChannels   = view.getUint16(22, true);
  const sampleRate    = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataSize      = view.getUint32(40, true);

  return { sampleRate, numChannels, bitsPerSample, dataSize };
}

// ---------------------------------------------------------------------------
// Waveform generation (streaming, chunked reads)
// ---------------------------------------------------------------------------

const WAVEFORM_PEAKS = 200;
const WAV_HEADER_SIZE = 44;

/**
 * Read the WAV file from R2 in a streaming fashion using getReader().
 * We skip the 44-byte header, then process PCM samples in chunks,
 * keeping one max-amplitude value per peak bucket — never loading the
 * entire file into memory at once.
 */
async function generateWaveformPeaks(
  r2: R2Bucket,
  audioKey: string
): Promise<number[]> {
  // Step 1: Read only the header (44 bytes) to get audio params
  const headerObj = await r2.get(audioKey, {
    range: { offset: 0, length: WAV_HEADER_SIZE },
  });
  if (!headerObj) {
    throw new Error(`Audio file not found in R2: ${audioKey}`);
  }
  const headerBuffer = await headerObj.arrayBuffer();
  const header = parseWavHeader(new Uint8Array(headerBuffer));

  const { sampleRate, numChannels, bitsPerSample, dataSize } = header;
  const bytesPerSample = bitsPerSample / 8;
  const samplesPerFrame = numChannels; // interleaved
  const bytesPerFrame = bytesPerSample * samplesPerFrame;
  const totalFrames = Math.floor(dataSize / bytesPerFrame);

  // How many frames per peak bucket
  const framesPerBucket = Math.max(1, Math.floor(totalFrames / WAVEFORM_PEAKS));

  // Step 2: Stream the full audio file body, process PCM data
  const audioObj = await r2.get(audioKey);
  if (!audioObj) {
    throw new Error(`Audio file not found in R2 (stream): ${audioKey}`);
  }

  const peaks: number[] = new Array(WAVEFORM_PEAKS).fill(0);
  let bytePosition = 0;     // position within the stream (absolute)
  let currentBucket = 0;    // which peak bucket we're filling
  let framesInBucket = 0;   // frames processed in current bucket
  let bucketMax = 0;        // max amplitude seen in current bucket

  // leftover bytes from a previous chunk that didn't align to a frame boundary
  let leftover: Uint8Array = new Uint8Array(0);

  const reader = (audioObj.body as ReadableStream<Uint8Array>).getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Merge leftover from previous chunk with new data
      let chunk: Uint8Array;
      if (leftover.length > 0) {
        chunk = new Uint8Array(leftover.length + value.length);
        chunk.set(leftover, 0);
        chunk.set(value, leftover.length);
        leftover = new Uint8Array(0);
      } else {
        chunk = value;
      }

      // Skip the WAV header bytes
      let startOffset = 0;
      if (bytePosition < WAV_HEADER_SIZE) {
        const skipBytes = Math.min(WAV_HEADER_SIZE - bytePosition, chunk.length);
        startOffset = skipBytes;
        bytePosition += skipBytes;
        if (startOffset >= chunk.length) continue; // entire chunk was header
      }

      // Process complete frames within this chunk
      const availableBytes = chunk.length - startOffset;
      const usableBytes = availableBytes - (availableBytes % bytesPerFrame);

      for (let i = startOffset; i < startOffset + usableBytes; i += bytesPerFrame) {
        if (currentBucket >= WAVEFORM_PEAKS) break;

        // Read all channels of this frame and take the max abs value
        let frameMax = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          const byteIdx = i + ch * bytesPerSample;
          let sample = 0;

          if (bitsPerSample === 16) {
            // Little-endian signed int16
            const lo = chunk[byteIdx];
            const hi = chunk[byteIdx + 1];
            const raw = (hi << 8) | lo;
            sample = raw > 0x7fff ? raw - 0x10000 : raw;
          } else if (bitsPerSample === 8) {
            // Unsigned int8, center at 128
            sample = chunk[byteIdx] - 128;
          } else if (bitsPerSample === 24) {
            const b0 = chunk[byteIdx];
            const b1 = chunk[byteIdx + 1];
            const b2 = chunk[byteIdx + 2];
            const raw = (b2 << 16) | (b1 << 8) | b0;
            sample = raw > 0x7fffff ? raw - 0x1000000 : raw;
          }

          const abs = Math.abs(sample);
          if (abs > frameMax) frameMax = abs;
        }

        if (frameMax > bucketMax) bucketMax = frameMax;
        framesInBucket++;

        if (framesInBucket >= framesPerBucket) {
          peaks[currentBucket] = bucketMax;
          currentBucket++;
          framesInBucket = 0;
          bucketMax = 0;
        }
      }

      bytePosition += chunk.length - startOffset;

      // Keep any leftover bytes that didn't fill a complete frame
      const remainder = availableBytes % bytesPerFrame;
      if (remainder > 0) {
        leftover = chunk.slice(chunk.length - remainder);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Fill any remaining bucket (in case total frames < WAVEFORM_PEAKS)
  if (currentBucket < WAVEFORM_PEAKS && bucketMax > 0) {
    peaks[currentBucket] = bucketMax;
  }

  // Normalize to 0-1 range
  const maxPeak = Math.max(...peaks, 1);
  const normalized = peaks.map((p) => Math.round((p / maxPeak) * 1000) / 1000);

  // Calculate expected max sample value for reference
  void sampleRate; // used in header parsing, not needed for normalization

  return normalized;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function postProcess(
  env: Env,
  songId: string,
  blueprint: SongBlueprint,
  lyrics: string,
  audioResult: MusicResult,
  artworkResult: ArtworkResult
): Promise<void> {
  // --- 1. Waveform generation (chunked streaming reads) ---
  let waveformUrl = "";
  try {
    const peaks = await generateWaveformPeaks(env.R2_BUCKET, audioResult.audioKey);
    const waveformKey = `waveforms/${songId}/waveform.json`;
    const waveformJson = JSON.stringify(peaks);

    await env.R2_BUCKET.put(waveformKey, waveformJson, {
      httpMetadata: { contentType: "application/json" },
    });

    waveformUrl = waveformKey;
  } catch (err) {
    // Waveform is non-critical — log and continue
    console.error("Waveform generation failed (non-fatal):", err);
  }

  // --- 2. Parse lyrics into structured JSON ---
  const sections = parseLyricsStructure(lyrics);
  const lyricsStructured = JSON.stringify(sections);

  // --- 3. Update D1 with all completed fields ---
  await songQueries.updateCompleted(env.DB, songId, {
    title: blueprint.title,
    genre: blueprint.genre,
    sub_genre: blueprint.sub_genre,
    mood: blueprint.mood,
    bpm: blueprint.bpm,
    key_signature: blueprint.key,
    time_signature: blueprint.time_signature,
    duration_seconds: blueprint.duration,
    vocal_style: blueprint.vocal_style,
    vocal_language: blueprint.vocal_language,
    instruments: JSON.stringify(blueprint.instruments),
    style_tags: blueprint.style_tags,
    lyrics,
    lyrics_structured: lyricsStructured,
    audio_url: audioResult.audioKey,
    audio_format: "wav",
    artwork_url: artworkResult.artwork_url,
    artwork_prompt: artworkResult.artwork_prompt,
    waveform_url: waveformUrl,
    ace_step_seed: audioResult.seed,
    ace_step_model: "turbo",
    ace_step_steps: 8,
  });
}
