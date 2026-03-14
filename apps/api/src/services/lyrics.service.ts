import { AI_MODELS, STAGE_TIMEOUTS } from "@melodia/shared";
import type { SongBlueprint } from "./blueprint.service.js";

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

const SONGWRITER_SYSTEM_PROMPT = `SYSTEM PROMPT — WORLD-CLASS SONGWRITER

You are a legendary songwriter who has penned #1 hits across every genre — from Afrobeats anthems to country ballads, from hip-hop bangers to R&B slow jams. Your lyrics win Grammys. Your hooks are unforgettable. Your verses tell stories that move people to tears or make them dance.

You will receive a SONG BLUEPRINT containing the genre, mood, concept, vocal style, and musical direction. Your job is to write lyrics that are:

1. AUTHENTIC to the genre — use the vocabulary, cadence, and cultural references that belong to this style of music.
2. STRUCTURED with clear section markers: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Chorus], [Outro]. Not every song needs every section — choose the structure that serves the song.
3. SINGABLE — lyrics must flow naturally when sung. Pay attention to syllable counts per line, vowel sounds on held notes, and rhythmic phrasing that matches the BPM.
4. EMOTIONALLY RESONANT — every line should serve the emotional arc. Verses build, pre-choruses create tension, choruses release and deliver the hook.
5. MEMORABLE — the chorus hook should be instantly singable after one listen. Use repetition strategically. Create earworms.
6. SOPHISTICATED — avoid clichés unless subverting them. Use vivid imagery, unexpected metaphors, and specific details that make the song feel lived-in and real.
7. GENRE-APPROPRIATE in length — Chorus: 4-8 lines. Verses: 8-16 lines. Bridge: 4-8 lines. Pre-Chorus: 2-4 lines.

FORMATTING RULES:
- Each section starts with a marker on its own line: [Verse 1], [Chorus], etc.
- One line of lyrics per line of text.
- Leave a blank line between sections.
- Do NOT include chords, timing marks, or production notes — only lyrics and section markers.
- If the song calls for ad-libs, write them in parentheses: (yeah, yeah)
- If the song has a spoken word intro or outro, mark it as [Spoken Intro] or [Spoken Outro].

OUTPUT: Only the lyrics with section markers. No commentary, no explanations.`;

const CRITIC_SYSTEM_PROMPT = `SYSTEM PROMPT — LYRICS QUALITY CRITIC

You are the harshest, most respected music critic in the industry. You've reviewed thousands of songs and you know exactly what separates a good song from a chart-topping masterpiece.

You will receive LYRICS and a SONG BLUEPRINT. Score the lyrics on these criteria (1-10 each):

1. HOOK STRENGTH — Is the chorus instantly memorable? Would someone hum it after one listen?
2. RHYME SCHEME — Are rhymes natural and varied? No forced rhymes. Internal rhymes earn bonus points.
3. EMOTIONAL ARC — Does the song build and release tension? Does it take the listener on a journey?
4. SYLLABLE FLOW — Do the lyrics sit naturally on the rhythm? Would they be easy to sing at the given BPM?
5. GENRE AUTHENTICITY — Do these lyrics belong in this genre? Would fans of this genre embrace them?
6. IMAGERY & SPECIFICITY — Are the lyrics vivid and specific, or vague and generic?
7. ORIGINALITY — Does this feel fresh? Or does it recycle tired tropes?
8. SINGABILITY — Are the vowel sounds on key words open and resonant? Are held notes on strong syllables?

If ANY score is below 7, output REVISED LYRICS that address the weaknesses.
If ALL scores are 7+, output the lyrics unchanged with a note: "APPROVED — no revisions needed."

OUTPUT FORMAT:
{
  "scores": { "hook": N, "rhyme": N, "arc": N, "flow": N, "authenticity": N, "imagery": N, "originality": N, "singability": N },
  "overall": N (average),
  "weaknesses": ["list of specific issues"],
  "revised_lyrics": "full revised lyrics OR 'APPROVED — no revisions needed'"
}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CriticScores = {
  hook: number;
  rhyme: number;
  arc: number;
  flow: number;
  authenticity: number;
  imagery: number;
  originality: number;
  singability: number;
};

type CriticResponse = {
  scores: CriticScores;
  overall: number;
  weaknesses: string[];
  revised_lyrics: string;
};

export type LyricsRefinementResult = {
  lyrics: string;
  scores: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callAIText(
  ai: Ai,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<string> {
  const aiCall = ai.run(model as Parameters<typeof ai.run>[0], {
    messages,
    temperature,
    max_tokens: maxTokens,
  } as Parameters<typeof ai.run>[1]);

  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Lyrics generation timed out")));
  });

  const result = await Promise.race([aiCall, timeout]) as { response?: string };
  return result?.response ?? "";
}

async function callWithFallback(
  ai: Ai,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<string> {
  try {
    return await callAIText(ai, AI_MODELS.LYRICS_PRIMARY, messages, temperature, maxTokens, signal);
  } catch (err) {
    console.warn("Primary lyrics model failed, using fallback:", err);
    return await callAIText(ai, AI_MODELS.LYRICS_FALLBACK, messages, temperature, maxTokens, signal);
  }
}

function extractCriticJSON(text: string): CriticResponse {
  try {
    return JSON.parse(text) as CriticResponse;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as CriticResponse;
    }
    throw new Error("Critic response was not valid JSON");
  }
}

function allScoresAbove7(scores: CriticScores): boolean {
  return Object.values(scores).every((s) => s >= 7);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export async function generateLyrics(ai: Ai, blueprint: SongBlueprint): Promise<string> {
  const signal = AbortSignal.timeout(STAGE_TIMEOUTS.LYRICS);

  const userMessage = `SONG BLUEPRINT:
Title: ${blueprint.title}
Genre: ${blueprint.genre} / ${blueprint.sub_genre}
Mood: ${blueprint.mood}
BPM: ${blueprint.bpm}
Key: ${blueprint.key}
Time Signature: ${blueprint.time_signature}
Duration: ${blueprint.duration} seconds
Vocal Style: ${blueprint.vocal_style}
Vocal Language: ${blueprint.vocal_language}
Instruments: ${blueprint.instruments.join(", ")}
Concept: ${blueprint.song_concept}

Write the full lyrics for this song.`;

  const messages = [
    { role: "system", content: SONGWRITER_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const text = await callWithFallback(ai, messages, 0.8, 1500, signal);
  return text.trim();
}

export async function refineLyrics(
  ai: Ai,
  lyrics: string,
  blueprint: SongBlueprint
): Promise<LyricsRefinementResult> {
  let currentLyrics = lyrics;
  let lastScores: Record<string, number> = {};

  for (let pass = 0; pass < 2; pass++) {
    const signal = AbortSignal.timeout(STAGE_TIMEOUTS.REFINEMENT);

    const userMessage = `SONG BLUEPRINT:
Genre: ${blueprint.genre} / ${blueprint.sub_genre}
Mood: ${blueprint.mood}
BPM: ${blueprint.bpm}
Vocal Style: ${blueprint.vocal_style}
Concept: ${blueprint.song_concept}

LYRICS TO REVIEW:
${currentLyrics}

Score the lyrics and provide revised lyrics if any score is below 7. Output valid JSON only.`;

    const messages = [
      { role: "system", content: CRITIC_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ];

    let criticResult: CriticResponse;
    try {
      const rawText = await callWithFallback(ai, messages, 0.7, 1500, signal);
      criticResult = extractCriticJSON(rawText);
    } catch (err) {
      console.warn(`Critic pass ${pass + 1} failed, returning current lyrics:`, err);
      break;
    }

    lastScores = criticResult.scores as unknown as Record<string, number>;

    // If all scores are 7+, approved — return unchanged
    if (allScoresAbove7(criticResult.scores)) {
      return { lyrics: currentLyrics, scores: lastScores };
    }

    // Use revised lyrics if provided
    const revised = criticResult.revised_lyrics?.trim();
    if (revised && revised !== "APPROVED — no revisions needed" && revised.length > 50) {
      currentLyrics = revised;
    } else {
      // No meaningful revision provided — stop
      break;
    }
  }

  return { lyrics: currentLyrics, scores: lastScores };
}
