import { requireEnv } from './env';

const MODEL = 'gemini-3.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Calls Gemini and returns parsed JSON. Throws a readable Error on any failure.
export async function geminiJSON(prompt, { temperature = 0.2, timeoutMs = 50000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY') },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Gemini took too long to respond. Try again.');
    throw new Error(`Could not reach Gemini: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${body?.error?.message || 'unknown error'}`);
  }
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) {
    const reason = candidate?.finishReason || body?.promptFeedback?.blockReason || 'empty response';
    throw new Error(`Gemini returned no content (${reason}).`);
  }
  return parseJSON(text);
}

function parseJSON(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
    }
    throw new Error('Gemini returned invalid JSON.');
  }
}
