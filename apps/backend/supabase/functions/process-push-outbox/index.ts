import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const BATCH_LIMIT = 20;
const MAX_ATTEMPTS = 5;
const TOKEN_BACKOFF_SECONDS = [30, 120, 600, 1800, 3600];

interface OutboxRow {
  id: number;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  attempts: number;
}

interface ExpoResponse {
  status: string;
  message?: string;
  details?: { error: string };
}

Deno.serve(async () => {
  const now = new Date().toISOString();

  const { data: rows, error: fetchError } = await supabase
    .from('push_outbox')
    .select('id, user_id, title, body, data, attempts')
    .in('status', ['pending', 'queued'])
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const outboxRows = (rows ?? []) as OutboxRow[];
  if (outboxRows.length === 0) {
    return Response.json({ processed: 0, sent: 0, failed: 0 });
  }

  const userIds = [...new Set(outboxRows.map((r) => r.user_id))];

  const { data: devices, error: devicesError } = await supabase
    .from('user_devices')
    .select('user_id, token')
    .in('user_id', userIds)
    .not('token', 'is', null);

  if (devicesError) {
    return Response.json({ error: devicesError.message }, { status: 500 });
  }

  const tokensByUser = new Map<string, string[]>();
  for (const d of devices ?? []) {
    if (d.token) {
      const list = tokensByUser.get(d.user_id) ?? [];
      list.push(d.token);
      tokensByUser.set(d.user_id, list);
    }
  }

  const messages: Array<Record<string, unknown>> = [];
  const outboxRowByMessage = new Map<number, number>(); // message offset -> outbox row index
  const noTokenRows: OutboxRow[] = [];

  outboxRows.forEach((row, index) => {
    const tokens = tokensByUser.get(row.user_id) ?? [];
    if (tokens.length === 0) {
      noTokenRows.push(row);
      return;
    }
    outboxRowByMessage.set(messages.length, index);
    messages.push({
      to: tokens,
      title: row.title,
      body: row.body,
      sound: 'default',
      data: row.data ?? {},
    });
  });

  // Rows with no device token are a terminal condition (nothing to retry).
  for (const row of noTokenRows) {
    await supabase
      .from('push_outbox')
      .update({ status: 'failed', error: 'no device tokens', attempts: row.attempts + 1 })
      .eq('id', row.id);
  }

  let sent = 0;
  let failed = noTokenRows.length;
  let skipped = 0;
  const deadTokenSets = new Map<string, Set<string>>();

  for (let start = 0; start < messages.length; start += 100) {
    const chunk = messages.slice(start, start + 100);
    const chunkResults: Array<ExpoResponse | null> = [];

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: Array<ExpoResponse> };
        chunkResults.push(...(json.data ?? []));
      } else {
        chunkResults.push(...chunk.map(() => null));
      }
    } catch {
      chunkResults.push(...chunk.map(() => null));
    }

    for (let i = 0; i < chunk.length; i++) {
      const outboxIndex = start + i;
      const rowIndex = outboxRowByMessage.get(outboxIndex);
      if (rowIndex === undefined) continue;

      const row = outboxRows[rowIndex];
      const result = chunkResults[i];

      if (result?.status === 'ok') {
        sent++;
        await supabase.from('push_outbox').update({ status: 'sent', error: null }).eq('id', row.id);
        continue;
      }

      failed++;
      const error = result?.details?.error ?? result?.message ?? 'expo push failed';
      const attempts = row.attempts + 1;

      if (error === 'DeviceNotRegistered') {
        const dead = deadTokenSets.get(row.user_id) ?? new Set<string>();
        for (const t of tokensByUser.get(row.user_id) ?? []) dead.add(t);
        deadTokenSets.set(row.user_id, dead);
      }

      const isPermanent =
        error === 'DeviceNotRegistered' || error === 'MessageTooBig' || error === 'InvalidCredentials';

      const status = isPermanent || attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      const backoffSeconds = TOKEN_BACKOFF_SECONDS[Math.min(attempts - 1, TOKEN_BACKOFF_SECONDS.length - 1)];

      await supabase
        .from('push_outbox')
        .update({
          status,
          attempts,
          error,
          next_attempt_at: status === 'queued' ? new Date(Date.now() + backoffSeconds * 1000).toISOString() : null,
        })
        .eq('id', row.id);

      if (status === 'failed' && attempts >= MAX_ATTEMPTS && !isPermanent) skipped++;
    }
  }

  // Clean up tokens Expo told us are permanently dead.
  for (const [userId, tokens] of deadTokenSets.entries()) {
    await supabase.from('user_devices').update({ token: null }).in('user_id', [userId]).in('token', [...tokens]);
  }

  return Response.json({ processed: outboxRows.length, sent, failed, skipped });
});