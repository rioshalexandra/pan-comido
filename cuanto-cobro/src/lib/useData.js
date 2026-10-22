import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Trae datos del servidor y permite recargarlos
export function useData(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(
    () =>
      api
        .get(url)
        .then((res) => {
          setData(res.data);
          setError('');
        })
        .catch((err) => setError(err.message)),
    [url]
  );
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, reload };
}
