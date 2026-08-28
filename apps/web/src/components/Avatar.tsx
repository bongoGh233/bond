const palette = ['#7C5CFF', '#FF6B8A', '#2BAD76', '#3B82F6', '#F0B429', '#F97316', '#0EA5E9', '#8B5CF6'];

export function Avatar({ name, colorId = 0, size = 40 }: { name?: string; colorId?: number; size?: number }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const bg = palette[colorId % palette.length];
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: bg }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
