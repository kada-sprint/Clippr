import { useState, useEffect, useRef } from 'react';
import { fetchClips } from './clips.api.js';

const POLL_INTERVAL = 5000;

export default function useClipPolling(projectId) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const data = await fetchClips(projectId, { signal: controller.signal });
        setClips(data);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Gagal memuat klip.');
        }
      } finally {
        setLoading(false);
      }
    }

    load();

    intervalRef.current = setInterval(load, POLL_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(intervalRef.current);
    };
  }, [projectId]);

  return { clips, setClips, loading, error };
}
