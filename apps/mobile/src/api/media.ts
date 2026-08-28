import { supabase, isBackendConfigured } from './supabase';

const BUCKET = 'bond-media';

export interface UploadedMedia {
  objectName: string;
  /** A URL that can be rendered (signed URL on backend, local URI in preview). */
  uri: string;
  mimeType: string;
}

function extFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/gif': return 'gif';
    case 'video/mp4': return 'mp4';
    case 'audio/mpeg':
    case 'audio/mp4': return 'm4a';
    case 'audio/wav': return 'wav';
    default: return 'bin';
  }
}

/**
 * Upload a local media file (from expo-image-picker, etc.) into the private
 * `bond-media` bucket under `{ownerId}/{uuid}.{ext}`, register it in the
 * `media` registry table so conversation/moment RLS can gate access, and return
 * a renderable (signed) URL.
 *
 * In preview mode (no backend) we no-op and return the original `file://` URI so
 * images still render in the demo.
 */
export async function uploadBondMedia(
  ownerId: string,
  uri: string,
  mimeType = 'image/jpeg',
  context?: { messageId?: string; momentId?: string }
): Promise<UploadedMedia> {
  if (isBackendConfigured && supabase) {
    const client = supabase;
    const ext = extFor(mimeType);
    const objectName = `${ownerId}/${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}.${ext}`;

    // 1) Fetch the local file as a Blob (works on native + web).
    let blob: Blob;
    try {
      const r = await fetch(uri);
      blob = await r.blob();
    } catch {
      return { objectName, uri, mimeType };
    }

    // 2) Upload into the owner's folder (storage policy media_write_own_folder).
    const { error: upErr } = await client.storage.from(BUCKET).upload(objectName, blob, {
      contentType: mimeType,
      upsert: false,
    });
    if (upErr) return { objectName, uri, mimeType };

    // 3) Register the object so reads are gated by message/moment membership.
    const { error: regErr } = await client.from('media').insert({
      owner_id: ownerId,
      bucket_id: BUCKET,
      object_name: objectName,
      message_id: context?.messageId ?? null,
      moment_id: context?.momentId ?? null,
      mime_type: mimeType,
      size_bytes: blob.size,
    });
    if (regErr) return { objectName, uri, mimeType };

    // 4) Request a short-lived signed URL for rendering.
    const { data } = await client.storage.from(BUCKET).createSignedUrl(objectName, 3600);
    return { objectName, uri: data?.signedUrl ?? uri, mimeType };
  }
  return { objectName: '', uri, mimeType };
}

/**
 * Resolve a media registry object (or stored uri) into a renderable URL.
 * Helper for reading back stored objects. Falls back to the stored uri.
 */
export async function resolveMediaUri(objectName: string | undefined, fallbackUri?: string): Promise<string> {
  if (!objectName || !supabase) return fallbackUri ?? '';
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(objectName, 3600);
  return data?.signedUrl ?? fallbackUri ?? '';
}
