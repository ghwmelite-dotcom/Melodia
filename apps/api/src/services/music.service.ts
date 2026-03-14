import { STAGE_TIMEOUTS } from "@melodia/shared";
import type { Env } from "../types.js";
import type { SongBlueprint } from "./blueprint.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MusicResult = {
  audioKey: string;
  seed: number;
};

// ---------------------------------------------------------------------------
// WAV Header builder
// ---------------------------------------------------------------------------

/**
 * Build a valid RIFF/WAV header for PCM audio.
 * Layout:
 *   RIFF chunk:  "RIFF" (4) + fileSize-8 (4) + "WAVE" (4)
 *   fmt  chunk:  "fmt " (4) + 16 (4) + PCM=1 (2) + channels (2) + sampleRate (4)
 *                + byteRate (4) + blockAlign (2) + bitsPerSample (2)
 *   data chunk:  "data" (4) + dataSize (4)
 * Total header: 44 bytes
 */
function buildWavHeader(
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  dataBytes: number
): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const fileSize = 36 + dataBytes; // RIFF chunk size = everything after the 8-byte RIFF header

  // RIFF chunk
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, fileSize, true);
  view.setUint8(8,  0x57); // 'W'
  view.setUint8(9,  0x41); // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true);           // chunk size (16 for PCM)
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  view.setUint32(28, byteRate, true);
  const blockAlign = numChannels * (bitsPerSample / 8);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataBytes, true);

  return new Uint8Array(header);
}

// ---------------------------------------------------------------------------
// Mock audio generator
// ---------------------------------------------------------------------------

function buildMockWav(durationSeconds: number): Uint8Array {
  const SAMPLE_RATE = 48000;
  const NUM_CHANNELS = 2;
  const BITS_PER_SAMPLE = 16;
  const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

  // Cap at 1 second of actual silence to keep the mock fast (<< 10 MB)
  const MAX_SILENCE_SECONDS = 1;
  const silenceSeconds = Math.min(durationSeconds, MAX_SILENCE_SECONDS);
  const dataBytes = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE * silenceSeconds;

  const header = buildWavHeader(SAMPLE_RATE, NUM_CHANNELS, BITS_PER_SAMPLE, dataBytes);
  const silence = new Uint8Array(dataBytes); // zeros = silence

  const combined = new Uint8Array(header.length + silence.length);
  combined.set(header, 0);
  combined.set(silence, header.length);
  return combined;
}

// ---------------------------------------------------------------------------
// Real ACE-Step integration
// ---------------------------------------------------------------------------

async function generateRealMusic(
  env: Env,
  blueprint: SongBlueprint,
  lyrics: string,
  songId: string
): Promise<MusicResult> {
  const signal = AbortSignal.timeout(STAGE_TIMEOUTS.MUSIC);

  const payload = {
    tags: blueprint.style_tags,
    lyrics,
    duration: blueprint.duration,
    seed: -1,
    model: "turbo",
    infer_step: 8,
    guidance_scale: 15.0,
    scheduler_type: "euler",
    batch_size: 1,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.ACE_STEP_API_KEY) {
    headers["Authorization"] = `Bearer ${env.ACE_STEP_API_KEY}`;
  }

  const response = await fetch(`${env.ACE_STEP_API_URL}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown error");
    throw new Error(`ACE-Step API returned ${response.status}: ${errText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioKey = `audio/${songId}/variation_0.wav`;

  await env.R2_BUCKET.put(audioKey, audioBuffer, {
    httpMetadata: { contentType: "audio/wav" },
  });

  // Try to read seed from response headers
  const seedHeader = response.headers.get("x-seed") ?? response.headers.get("x-ace-step-seed");
  const seed = seedHeader ? parseInt(seedHeader, 10) || 0 : 0;

  return { audioKey, seed };
}

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

async function generateMockMusic(
  env: Env,
  blueprint: SongBlueprint,
  songId: string
): Promise<MusicResult> {
  console.warn("ACE-Step not configured, using mock audio");

  const wavData = buildMockWav(blueprint.duration);
  const audioKey = `audio/${songId}/variation_0.wav`;

  await env.R2_BUCKET.put(audioKey, wavData, {
    httpMetadata: { contentType: "audio/wav" },
  });

  return { audioKey, seed: 0 };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateMusic(
  env: Env,
  blueprint: SongBlueprint,
  lyrics: string,
  songId: string
): Promise<MusicResult> {
  if (env.ACE_STEP_API_URL) {
    return generateRealMusic(env, blueprint, lyrics, songId);
  }
  return generateMockMusic(env, blueprint, songId);
}
