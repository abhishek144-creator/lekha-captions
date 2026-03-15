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

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Fetch the audio/video file
    const response = await fetch(file_url);
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch video file' }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/mp4' });
    const file = new File([blob], 'audio.mp4', { type: 'audio/mp4' });

    // Transcribe with Whisper - auto-detect language and get word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: file,
      response_format: "verbose_json",
      timestamp_granularities: ["word"] // Get word-level timestamps for precise sync
    });

    // Build segments with word-level timing data
    const segments = [];
    let currentSegmentStart = null;
    let currentSegmentText = [];
    let currentSegmentWords = [];

    if (transcription.words && transcription.words.length > 0) {
      // Group words into segments by natural pauses (roughly every 10-15 words or when there's a timing gap)
      for (let i = 0; i < transcription.words.length; i++) {
        const word = transcription.words[i];

        if (currentSegmentStart === null) {
          currentSegmentStart = word.start;
        }

        currentSegmentText.push(word.word);
        currentSegmentWords.push({
          word: word.word,
          start: word.start,
          end: word.end
        });

        // Create a segment after ~10 words or at the end
        if (currentSegmentText.length >= 10 || i === transcription.words.length - 1) {
          segments.push({
            start: currentSegmentStart,
            end: transcription.words[i].end,
            text: currentSegmentText.join(' '),
            words: currentSegmentWords
          });

          currentSegmentStart = null;
          currentSegmentText = [];
          currentSegmentWords = [];
        }
      }
    } else if (transcription.segments && transcription.segments.length > 0) {
      // Fallback to segment-level if word-level is not available
      segments.push(...transcription.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        words: [] // No word-level data in this fallback
      })));
    }

    return Response.json({
      success: true,
      text: transcription.text,
      segments: segments,
      language: transcription.language,
      word_count: transcription.words?.length || 0
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});