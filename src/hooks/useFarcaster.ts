import { useState, useEffect, useCallback } from 'react';
import type { CastItem, ReactionItem, UserAuth } from '../types/index.js';
import { getCastsByFid, getReactionsByFid } from '../lib/farcaster.js';

export const useFarcaster = (auth: UserAuth | null) => {
  const [casts, setCasts] = useState<CastItem[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!auth) return;

    setLoading(true);
    setError(null);
    try {
      const [fetchedCasts, fetchedReactions] = await Promise.all([
        getCastsByFid(auth.fid),
        getReactionsByFid(auth.fid),
      ]);

      setCasts(fetchedCasts);
      setReactions(fetchedReactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth) {
      fetchData();
    }
  }, [auth, fetchData]);

  return { casts, reactions, loading, error, refetch: fetchData };
};
