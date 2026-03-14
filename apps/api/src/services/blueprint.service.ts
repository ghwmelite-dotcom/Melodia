import { AI_MODELS, STAGE_TIMEOUTS } from "@melodia/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SongBlueprint = {
  title: string;
  genre: string;
  sub_genre: string;
  mood: string;
  bpm: number;
  key: string;
  time_signature: string;
  duration: number;
  vocal_style: string;
  vocal_language: string;
  instruments: string[];
  style_tags: string;
  artwork_mood: string;
  song_concept: string;
};

export type BlueprintOverrides = {
  genre?: string;
  mood?: string;
  language?: string;
  duration?: number;
};

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const BLUEPRINT_SYSTEM_PROMPT = `SYSTEM PROMPT — SONG BLUEPRINT GENERATOR

You are the world's most accomplished music director and A&R executive. You've discovered and produced hundreds of award-winning songs across every genre. Your job is to take a user's raw idea — which could be as vague as a single word or as detailed as a full brief — and craft a comprehensive song blueprint that would guide a world-class production team.

RULES:
1. Always output valid JSON matching the schema below.
2. If the user gives minimal input, make BOLD creative choices. Don't play it safe — choose specific, evocative directions.
3. Match the genre authentically. An Afrobeats song needs West African percussion and rhythmic patterns. A country song needs steel guitar and storytelling. A trap song needs 808s and hi-hats.
4. BPM must be genre-appropriate (e.g., Afrobeats: 90-110, Trap: 130-160, Ballad: 60-80, Pop: 100-130, EDM: 120-150).
5. Key signature should match the mood (minor keys for melancholy/intensity, major for upbeat/happy).
6. Style tags should be richly descriptive — at least 10 comma-separated tags covering genre, sub-genre, mood, vocal style, instrumentation character, and production style.
7. Duration should be genre-appropriate (Pop: 180-240s, Ballad: 240-300s, EDM: 180-360s, Hip-hop: 180-240s).
8. Artwork mood should paint a vivid visual scene that captures the song's emotional essence.

OUTPUT SCHEMA:
{
  "title": "string — creative, memorable song title",
  "genre": "string — primary genre",
  "sub_genre": "string — specific sub-genre",
  "mood": "string — 2-4 mood descriptors, comma-separated",
  "bpm": number,
  "key": "string — e.g., 'Dm', 'G', 'Bb minor'",
  "time_signature": "string — e.g., '4/4', '3/4', '6/8'",
  "duration": number (seconds),
  "vocal_style": "string — detailed vocal character description",
  "vocal_language": "string — ISO 639-1 code",
  "instruments": ["array", "of", "specific", "instruments"],
  "style_tags": "string — richly descriptive comma-separated tags for ACE-Step",
  "artwork_mood": "string — vivid visual scene description for image generation",
  "song_concept": "string — 2-3 sentence creative direction for the lyrics"
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_BLUEPRINT_FIELDS: (keyof SongBlueprint)[] = [
  "title",
  "genre",
  "sub_genre",
  "mood",
  "bpm",
  "key",
  "time_signature",
  "duration",
  "vocal_style",
  "vocal_language",
  "instruments",
  "style_tags",
  "artwork_mood",
  "song_concept",
];

function validateBlueprint(obj: unknown): obj is SongBlueprint {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  for (const field of REQUIRED_BLUEPRINT_FIELDS) {
    if (record[field] === undefined || record[field] === null) return false;
  }
  if (typeof record["bpm"] !== "number") return false;
  if (typeof record["duration"] !== "number") return false;
  if (!Array.isArray(record["instruments"])) return false;
  return true;
}

async function callAI(
  ai: Ai,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<string> {
  // Workers AI: abort signal support varies; wrap in Promise.race for safety
  const aiCall = ai.run(model as Parameters<typeof ai.run>[0], {
    messages,
    temperature,
    max_tokens: maxTokens,
  } as Parameters<typeof ai.run>[1]);

  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Blueprint generation timed out")));
  });

  const result = await Promise.race([aiCall, timeout]) as { response?: string };
  const text = result?.response ?? "";
  return text;
}

function buildUserMessage(userPrompt: string, overrides?: BlueprintOverrides): string {
  let message = userPrompt;
  const parts: string[] = [];
  if (overrides?.genre) parts.push(`genre=${overrides.genre}`);
  if (overrides?.mood) parts.push(`mood=${overrides.mood}`);
  if (overrides?.language) parts.push(`vocal_language=${overrides.language}`);
  if (overrides?.duration) parts.push(`duration=${overrides.duration}s`);
  if (parts.length > 0) {
    message += `\n\nThe user specifically requested: ${parts.join(", ")}`;
  }
  return message;
}

function extractJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Extract JSON object from surrounding text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("No valid JSON found in response");
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateBlueprint(
  ai: Ai,
  userPrompt: string,
  overrides?: BlueprintOverrides
): Promise<SongBlueprint> {
  const signal = AbortSignal.timeout(STAGE_TIMEOUTS.BLUEPRINT);
  const userMessage = buildUserMessage(userPrompt, overrides);

  const messages = [
    { role: "system", content: BLUEPRINT_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // First attempt with primary model
  let rawText = "";
  try {
    rawText = await callAI(
      ai,
      AI_MODELS.LYRICS_PRIMARY,
      messages,
      0.9,
      500,
      signal
    );
    const parsed = extractJSON(rawText);
    if (validateBlueprint(parsed)) return parsed;
  } catch (err) {
    // Primary model failed — try fallback
    console.warn("Blueprint primary model failed, trying fallback:", err);
  }

  // Retry with fallback model and explicit JSON-only instruction
  const retryMessages = [
    { role: "system", content: BLUEPRINT_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
    {
      role: "assistant",
      content: rawText || "",
    },
    {
      role: "user",
      content: "Output ONLY valid JSON, no commentary. The JSON must match the schema exactly.",
    },
  ];

  try {
    const fallbackText = await callAI(
      ai,
      AI_MODELS.LYRICS_FALLBACK,
      retryMessages,
      0.9,
      500,
      signal
    );
    const parsed = extractJSON(fallbackText);
    if (validateBlueprint(parsed)) return parsed;
    throw new Error("Fallback model produced invalid blueprint schema");
  } catch (err) {
    throw new Error(`Blueprint generation failed after retry: ${err instanceof Error ? err.message : String(err)}`);
  }
}
