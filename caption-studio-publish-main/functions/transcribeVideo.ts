import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Reject URLs that point at the loopback/link-local/private/internal address
// space so a user-supplied `file_url` can't be used to make the server issue
// requests to cloud metadata endpoints or internal-only services (SSRF).
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.internal') || host.endsWith('.local')) return true;
  // IPv6 loopback / unique-local / link-local
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  // IPv4 literals in private / loopback / link-local (incl. 169.254 metadata) ranges
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  }
  return false;
}

function assertSafeFetchUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid file_url');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('file_url must be an https URL');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('file_url host is not allowed');
  }
  return parsed;
}

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

    let safeUrl: URL;
    try {
      safeUrl = assertSafeFetchUrl(file_url);
    } catch (validationError) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    // Fetch the audio/video file. `redirect: 'error'` prevents a public URL from
    // 3xx-redirecting into the blocked internal address space after the check.
    const response = await fetch(safeUrl, { redirect: 'error' });
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