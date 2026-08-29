import { useEffect, useState } from 'react';
import { listConnections, type ConnectionUser } from '../api/connections';

/**
 * Load the current user's accepted-connection list for recipient pickers.
 */
export function useRecipients(me: string): { options: ConnectionUser[]; loaded: boolean } {
  const [options, setOptions] = useState<ConnectionUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    listConnections(me).then((data) => {
      if (!mounted) return;
      setOptions(data);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [me]);

  return { options, loaded };
}

/**
 * Selectable recipient chips. Keeps the selection valid as connections load:
 * if the current value is no longer available it falls back to the first
 * connection.
 */
export function RecipientPicker({
  options,
  value,
  onChange,
}: {
  options: ConnectionUser[];
  value?: string;
  onChange: (id: string) => void;
}) {
  if (options.length === 0) return null;
  const active = options.some((o) => o.id === value) ? value : options[0].id;
  return (
    <div className="seg" role="group" aria-label="Recipient">
      {options.map((o) => (
        <button
          key={o.id}
          className={'seg-btn' + (active === o.id ? ' active' : '')}
          onClick={() => onChange(o.id)}
        >
          {o.displayName}
        </button>
      ))}
    </div>
  );
}