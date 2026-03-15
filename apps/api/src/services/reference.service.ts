import { AI_MODELS } from "@melodia/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReferenceAnalysis = {
  transcription: string | null;
  style_description: string;
  extracted_tags: string;
  detected_genre: string;
  detected_mood: string;
  estimated_bpm: string;
  vocal_character: string;
  instrumentation: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STYLE_ANALYSIS_SYSTEM_PROMPT = `You are a world-class music producer. Analyze this reference track based on the provided transcription and context. Output valid JSON with fields: style_description (2-3 sentences), extracted_tags (10+ comma-separated), detected_genre, detected_mood (2-3 descriptors), estimated_bpm, vocal_character, instrumentation.`;

function buildUserMessage(transcription: string | null): string {
  const transcriptionSection = transcription
    ? `Transcription of vocals:\n"${transcription.slice(0, 1000)}"`
    : "Instrumental track — no vocals detected";

  return `Analyze the style and production characteristics of this reference track.\n\n${transcriptionSection}\n\nProvide a detailed musical analysis as valid JSON only.`;
}

async function runStyleAnalysis(
  ai: Ai,
  transcription: string | null,
  extraInstruction?: string
): Promise<ReferenceAnalysis> {
  const systemPrompt = extraInstruction
    ? `${STYLE_ANALYSIS_SYSTEM_PROMPT} ${extraInstruction}`
    : STYLE_ANALYSIS_SYSTEM_PROMPT;

  let rawText: string | null = null;

  // Try primary model first
  try {
    const response = await (ai.run as (model: string, input: Record<string, unknown>) => Promise<unknown>)(
      AI_MODELS.LYRICS_PRIMARY,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(transcription) },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }
    ) as { response?: string };
    rawText = response?.response ?? null;
  } catch {
    // Fall through to fallback model
  }

  // Fallback model if primary returned nothing
  if (!rawText) {
    const fallbackResponse = await (ai.run as (model: string, input: Record<string, unknown>) => Promise<unknown>)(
      AI_MODELS.LYRICS_FALLBACK,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(transcription) },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }
    ) as { response?: string };
    rawText = fallbackResponse?.response ?? null;
  }

  if (!rawText) {
    throw new Error("Both LLM models returned empty responses for style analysis");
  }

  // Extract JSON from the response — handles markdown code fences
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    rawText.match(/(\{[\s\S]*\})/);

  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : rawText.trim();

  const parsed = JSON.parse(jsonStr) as Partial<ReferenceAnalysis>;

  // Validate all required fields exist
  const requiredFields: Array<keyof Omit<ReferenceAnalysis, "transcription">> = [
    "style_description",
    "extracted_tags",
    "detected_genre",
    "detected_mood",
    "estimated_bpm",
    "vocal_character",
    "instrumentation",
  ];

  for (const field of requiredFields) {
    if (!parsed[field]) {
      throw new Error(`Missing required field in style analysis: ${field}`);
    }
  }

  return {
    transcription,
    style_description: parsed.style_description!,
    extracted_tags: parsed.extracted_tags!,
    detected_genre: parsed.detected_genre!,
    detected_mood: parsed.detected_mood!,
    estimated_bpm: parsed.estimated_bpm!,
    vocal_character: parsed.vocal_character!,
    instrumentation: parsed.instrumentation!,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyzeReference(
  ai: Ai,
  audioBytes: ArrayBuffer
): Promise<ReferenceAnalysis> {
  // -------------------------------------------------------------------------
  // Step 1: Whisper transcription
  // -------------------------------------------------------------------------
  let transcription: string | null = null;

  try {
    const whisperResponse = await (ai.run as (model: string, input: Record<string, unknown>) => Promise<unknown>)(
      AI_MODELS.WHISPER,
      { audio: [...new Uint8Array(audioBytes)] }
    ) as { text?: string } | null;

    const text = whisperResponse?.text?.trim() ?? null;
    transcription = text && text.length > 0 ? text : null;
  } catch (err) {
    console.warn("[ReferenceService] Whisper transcription failed, continuing without:", err);
    transcription = null;
  }

  // -------------------------------------------------------------------------
  // Step 2: LLM style analysis (with one retry on parse failure)
  // -------------------------------------------------------------------------
  try {
    return await runStyleAnalysis(ai, transcription);
  } catch (firstErr) {
    console.warn("[ReferenceService] First style analysis attempt failed, retrying:", firstErr);
    try {
      return await runStyleAnalysis(
        ai,
        transcription,
        "Output ONLY valid JSON — no explanation, no markdown, no code fences."
      );
    } catch (secondErr) {
      console.error("[ReferenceService] Style analysis failed on retry:", secondErr);
      // Return a safe fallback so the pipeline can continue without reference data
      return {
        transcription,
        style_description: "Unable to analyze reference track style.",
        extracted_tags: "unknown",
        detected_genre: "unknown",
        detected_mood: "unknown",
        estimated_bpm: "unknown",
        vocal_character: "unknown",
        instrumentation: "unknown",
      };
    }
  }
}
