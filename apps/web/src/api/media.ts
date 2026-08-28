import { supabase, isBackendConfigured } from '../supabase';

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
    case 'image/webp': return 'webp';
    case 'video/mp4': return 'mp4';
    case 'audio/mpeg':
    case 'audio/mp4': return 'm4a';
    case 'audio/wav': return 'wav';
    default: return 'bin';
  }
}

/**
 * Upload a media blob/file (or anything `fetch`-able, i.e. object URLs) into the
 * private `bond-media` bucket under `{ownerId}/{uuid}.{ext}`, register it in the
 * `media` registry so message/moment RLS can gate reads, and return a renderable
 * signed URL. In preview mode we keep the local (object) URL.
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

    let blob: Blob;
    try {
      const r = await fetch(uri);
      blob = await r.blob();
    } catch {
      return { objectName, uri, mimeType };
    }

    const { error: upErr } = await client.storage.from(BUCKET).upload(objectName, blob, {
      contentType: mimeType,
      upsert: false,
    });
    if (upErr) return { objectName, uri, mimeType };

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

    const { data } = await client.storage.from(BUCKET).createSignedUrl(objectName, 3600);
    return { objectName, uri: data?.signedUrl ?? uri, mimeType };
  }
  return { objectName: '', uri, mimeType };
}

/** Create a renderable object URL for a picked file (preview mode). */
export function objectUrlFor(file: File): string {
  return URL.createObjectURL(file);
}