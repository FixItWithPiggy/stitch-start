// "Ask Claude" for a saved project.
// The app sends only the project id. This function loads the project, builds the
// prompt from the shared rules, attaches the design picture, and calls the Claude API.
// The API key never leaves the server.
import { buildAdvicePrompt } from '../_shared/engine.ts';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/http.ts';
import { getMachine } from '../_shared/machines.ts';
import type { ProjectInput } from '../_shared/types.ts';

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
const DAILY_LIMIT = Number(Deno.env.get('DAILY_ADVICE_LIMIT') ?? '20');
const CLAUDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Claude is not set up on the server yet.' }, 503);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: 'Please sign in again.' }, 401);

  const body = await req.json().catch(() => ({}));
  const projectId = typeof body?.projectId === 'string' ? body.projectId : null;
  if (!projectId) return json({ error: 'Missing project.' }, 400);

  // Only the owner's project, never anyone else's.
  const { data: row, error: rowError } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (rowError) return json({ error: 'Could not load the project.' }, 500);
  if (!row) return json({ error: 'Project not found.' }, 404);

  const machine = getMachine(row.machine_id);
  if (!machine) return json({ error: "This project's machine isn't in the library." }, 400);

  // Daily limit protects your Claude bill.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return json({ error: `You've asked Claude ${DAILY_LIMIT} times in the last day. Try again tomorrow.` }, 429);
  }

  // Attach the design picture if there is one Claude can read.
  let image: { media_type: string; data: string } | null = null;
  if (row.image_path) {
    const { data: blob } = await admin.storage.from('designs').download(row.image_path);
    if (blob && CLAUDE_IMAGE_TYPES.includes(blob.type) && blob.size <= MAX_IMAGE_BYTES) {
      image = { media_type: blob.type, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) };
    }
  }

  const input: ProjectInput = {
    machineId: row.machine_id,
    projectType: row.project_type,
    item: row.item,
    letterText: row.letter_text,
    letterHeight: row.letter_height,
    width: row.width,
    height: row.height,
    notes: row.notes,
    fileKind: row.file_kind,
    fileExt: row.file_ext,
  };
  const prompt = buildAdvicePrompt(machine, input, image !== null);

  const content: unknown[] = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', ...image } });
  content.push({ type: 'text', text: prompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) {
    console.error('Claude API error', res.status, await res.text());
    const busy = res.status === 429 || res.status === 529;
    return json(
      { error: busy ? 'Claude is busy right now. Try again in a few minutes.' : 'Claude is not available right now. Try again later.' },
      502,
    );
  }

  const data = await res.json();
  const advice = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
  if (!advice) return json({ error: "Claude didn't return an answer. Try again." }, 502);

  await admin.from('ai_usage').insert({ user_id: user.id });
  await admin
    .from('projects')
    .update({ advice, advice_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', user.id);

  return json({ advice });
});
