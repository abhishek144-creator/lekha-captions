import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { segments, source_language = 'english', target_language = 'english' } = await req.json();

    if (!segments || !Array.isArray(segments)) {
      return Response.json({ error: 'segments array is required' }, { status: 400 });
    }

    // If source and target are the same, return original segments
    if (source_language.toLowerCase() === target_language.toLowerCase()) {
      return Response.json({
        success: true,
        segments: segments,
        count: segments.length
      });
    }

    const translatedSegments = [];
    const batchSize = 5;

    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const batchPrompt = batch.map((seg, idx) => `${idx + 1}. "${seg.text}"`).join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert translator for social media content. 
Translate ${source_language} text to ${target_language}. Make translations:
- SHORT and punchy (max 8-10 words each)
- Maintain original meaning and tone
- Use natural, conversational language
- Perfect for video captions

Reply with ONLY numbered translations, one per line. DO NOT include source text.`
          },
          {
            role: "user",
            content: `Translate these to ${target_language}:\n${batchPrompt}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const translations = response.choices[0].message.content.trim().split('\n');

      batch.forEach((seg, idx) => {
        let translatedText = translations[idx] || seg.text;
        // Remove numbering if present (e.g., "1. " or "1) ")
        translatedText = translatedText.replace(/^\d+[\.\)]\s*/, '').trim();

        translatedSegments.push({
          start: seg.start,
          end: seg.end,
          text: translatedText,
          original: seg.text,
          words: seg.words // Preserve word-level timestamps if they exist
        });
      });
    }

    return Response.json({
      success: true,
      segments: translatedSegments,
      source_language: source_language,
      target_language: target_language,
      count: translatedSegments.length
    });

  } catch (error) {
    console.error('Translation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});