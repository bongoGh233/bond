export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'document';

export interface MediaMetadata {
  uri?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  /** Storage object path in the bond-media bucket (set when uploaded live). */
  objectName?: string;
}