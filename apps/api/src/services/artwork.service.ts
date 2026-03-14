import { AI_MODELS, STAGE_TIMEOUTS } from "@melodia/shared";
import type { SongBlueprint } from "./blueprint.service.js";

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const ART_DIRECTOR_SYSTEM_PROMPT = `You are an elite album cover art director. You create visual concepts for album artwork that capture the emotional essence of music. Your covers are iconic — think Childish Gambino's "Awaken My Love", Kendrick Lamar's "DAMN.", Burna Boy's "African Giant", or Adele's "30".

Given a song's metadata, output a single detailed image generation prompt (100-150 words) that describes an album cover.

RULES:
1. NEVER include text, letters, words, or typography in the image description — text renders poorly in AI images.
2. Focus on mood, atmosphere, color palette, composition, and symbolic imagery.
3. Match the genre's visual language — Afrobeats covers use vibrant colors and African motifs; R&B uses intimate/moody lighting; Hip-hop uses bold graphic compositions; Pop uses bright, clean aesthetics.
4. Specify the art style: photographic, illustrated, abstract, collage, minimalist, surrealist, etc.
5. Include specific color palette guidance.
6. The image should work as a square (1:1 ratio) album cover.

OUTPUT: Only the image prompt. No commentary.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtworkResult = {
  artwork_url: string;
  artwork_prompt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function streamToUint8Array(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateArtwork(
  ai: Ai,
  blueprint: SongBlueprint,
  songTitle: string,
  songId: string,
  r2: R2Bucket
): Promise<ArtworkResult> {
  const signal = AbortSignal.timeout(STAGE_TIMEOUTS.ARTWORK);

  // Step 1: LLM art direction — generate image prompt
  const artDirectionMessages = [
    { role: "system", content: ART_DIRECTOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Song Title: "${songTitle}"
Genre: ${blueprint.genre} / ${blueprint.sub_genre}
Mood: ${blueprint.mood}
Artwork Direction: ${blueprint.artwork_mood}
Key Instruments: ${blueprint.instruments.join(", ")}
Concept: ${blueprint.song_concept}`,
    },
  ];

  const artDirectionCall = ai.run(AI_MODELS.LYRICS_PRIMARY as Parameters<typeof ai.run>[0], {
    messages: artDirectionMessages,
    temperature: 0.9,
    max_tokens: 300,
  } as Parameters<typeof ai.run>[1]);

  const artDirectionTimeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Artwork art direction timed out")));
  });

  const artDirectionResult = await Promise.race([artDirectionCall, artDirectionTimeout]) as {
    response?: string;
  };
  const imagePrompt = artDirectionResult?.response?.trim() ?? "";

  if (!imagePrompt) {
    throw new Error("Art direction produced an empty prompt");
  }

  // Step 2: Image generation via FLUX.2
  const imageCall = ai.run(AI_MODELS.ARTWORK as Parameters<typeof ai.run>[0], {
    prompt: imagePrompt,
    width: 1024,
    height: 1024,
    num_steps: 20,
    guidance: 7.5,
  } as Parameters<typeof ai.run>[1]);

  const imageTimeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Artwork image generation timed out")));
  });

  const imageResult = await Promise.race([imageCall, imageTimeout]);

  // Workers AI image models return a ReadableStream of PNG bytes
  let imageBytes: Uint8Array;
  if (imageResult instanceof ReadableStream) {
    imageBytes = await streamToUint8Array(imageResult as ReadableStream<Uint8Array>);
  } else if (imageResult instanceof Uint8Array) {
    imageBytes = imageResult;
  } else if (imageResult instanceof ArrayBuffer) {
    imageBytes = new Uint8Array(imageResult);
  } else {
    // Fallback: treat as unknown binary
    imageBytes = new Uint8Array(imageResult as ArrayBuffer);
  }

  // Step 3: Upload to R2
  const artworkKey = `artwork/${songId}/cover.png`;
  await r2.put(artworkKey, imageBytes, {
    httpMetadata: { contentType: "image/png" },
    customMetadata: {
      prompt: imagePrompt,
      model: AI_MODELS.ARTWORK,
    },
  });

  return {
    artwork_url: artworkKey,
    artwork_prompt: imagePrompt,
  };
}
