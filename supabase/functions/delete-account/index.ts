// Permanently deletes the signed-in person's account and everything they saved.
// Apple requires apps that let people create accounts to let them delete them too.
import { adminClient, corsHeaders, json, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: 'Please sign in again.' }, 401);

  // Remove uploaded pictures (they live in a folder named after the user id).
  const folder = user.id;
  for (;;) {
    const { data: files } = await admin.storage.from('designs').list(folder, { limit: 100 });
    if (!files || files.length === 0) break;
    await admin.storage.from('designs').remove(files.map((f) => `${folder}/${f.name}`));
    if (files.length < 100) break;
  }

  // Deleting the user removes their machines, projects and usage rows (on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete user failed', error);
    return json({ error: 'Could not delete the account.' }, 500);
  }
  return json({ ok: true });
});
