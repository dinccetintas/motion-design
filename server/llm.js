// Claude access for the agent team. Every call streams (thinking summaries flow to the UI
// as the agent's live "thoughts") and returns schema-constrained JSON.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.STUDIO_MODEL || 'claude-opus-5-5';
let client = null;

/** True when credentials for the Claude API are configured. */
export function hasLLM() {
  if (process.env.STUDIO_OFFLINE === '1') return false;
  return !!(process.env.ANTHROPIC_API_KEY || process.env.STUDIO_ANTHROPIC_KEY);
}
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.STUDIO_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY, maxRetries: 3 });
  return client;
}
/** Tests inject a fake client with the same `beta.messages.stream` shape. */
export function setClient(c) { client = c; }

export class AgentError extends Error {}

/**
 * Run one agent turn and return its JSON output.
 * o: { system, content (string | blocks), schema, effort, tools, maxTokens, onThink(text), onSearch(query) }
 */
export async function callJSON(o) {
  const c = getClient();
  const params = {
    model: MODEL,
    max_tokens: o.maxTokens || 32000,
    system: [{ type: 'text', text: o.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: o.content }],
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: o.effort || 'medium', ...(o.schema ? { format: { type: 'json_schema', schema: o.schema } } : {}) },
    // Policy declines are rerouted server-side instead of failing the whole run.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
  if (o.tools) params.tools = o.tools;
  let messages = params.messages, final = null;
  // pause_turn can happen on long server-tool (web search) turns: resume until done.
  for (let round = 0; round < 4; round++) {
    const stream = c.beta.messages.stream({ ...params, messages });
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'thinking_delta' && ev.delta.thinking) o.onThink?.(ev.delta.thinking);
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'server_tool_use' && ev.content_block.name === 'web_search') o.onSearch?.(ev.content_block.input?.query || '');
    }
    final = await stream.finalMessage();
    if (final.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: final.content }]; continue; }
    break;
  }
  if (final.stop_reason === 'refusal') throw new AgentError('The model declined this request' + (final.stop_details?.explanation ? ': ' + final.stop_details.explanation : '.'));
  if (final.stop_reason === 'max_tokens') throw new AgentError('The agent ran out of output space.');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!o.schema) return { text, message: final };
  try { return JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new AgentError('The agent returned invalid JSON.');
  }
}
