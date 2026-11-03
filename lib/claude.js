// Shared Claude client. Reads ANTHROPIC_API_KEY from the environment.
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// If the model declines, the API re-runs the request on Anthropic's
// recommended fallback model within the same call.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client;
const getClient = () => (client ||= new Anthropic());
const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

class RefusalError extends Error {}

// Ask Claude for JSON matching `schema` (structured outputs) and parse it.
async function generateJson({ system, prompt, schema, effort = 'medium', maxTokens = 8000 }) {
  const message = await getClient().beta.messages.create({
    model: MODEL,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    max_tokens: maxTokens,
    system,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }]
  });
  if (message.stop_reason === 'refusal') throw new RefusalError('The model declined this request.');
  if (message.stop_reason === 'max_tokens') throw new Error('The model ran out of output tokens.');
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

module.exports = { Anthropic, MODEL, isConfigured, generateJson, RefusalError };
