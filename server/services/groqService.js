/**
 * Groq LLM Service
 * Handles all communication with the Groq API using llama-3.3-70b-versatile.
 * Provides structured JSON output parsing and graceful timeout handling.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Send a chat completion request to the Groq API.
 * @param {string} systemPrompt - The system-level instruction prompt.
 * @param {string} userPrompt - The user-level data prompt.
 * @param {boolean} jsonMode - If true, request JSON output format.
 * @returns {Promise<{success: boolean, content: string|null, parsed: object|null, error: string|null}>}
 */
export async function callGroqLLM(systemPrompt, userPrompt, jsonMode = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, content: null, parsed: null, error: 'GROQ_API_KEY not configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 2048
    };

    // Enable JSON mode via response_format
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await globalThis.fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, content: null, parsed: null, error: `Groq API ${response.status}: ${errBody.substring(0, 200)}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;

    // Attempt JSON parsing if jsonMode was requested
    let parsed = null;
    if (jsonMode && content) {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        // Try to extract JSON from markdown fences
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[1].trim()); } catch (e2) { /* ignore */ }
        }
      }
    }

    return { success: true, content, parsed, error: null };

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, content: null, parsed: null, error: 'Groq API request timed out after 10s' };
    }
    return { success: false, content: null, parsed: null, error: err.message };
  }
}
