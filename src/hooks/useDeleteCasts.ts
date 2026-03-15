import { useState, useCallback } from 'react';
import type { UserAuth, DeletionResult, CastItem, ReactionItem } from '../types/index.js';
import { deleteAllActivity } from '../lib/deleteAllActivity.js';

export const useDeleteCasts = (auth: UserAuth | null) => {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<DeletionResult[]>([]);

  const deleteAll = useCallback(async (casts: CastItem[], reactions: ReactionItem[]) => {
    if (!auth) return;

    setTotal(casts.length + reactions.length);
    setProgress(0);
    setResults([]);
    await deleteAllActivity(auth, casts, reactions, {
      onProgress: (result, nextProgress) => {
        setResults((prev) => [...prev, result]);
        setProgress(nextProgress.completed);
      },
    });
  }, [auth]);

  return { deleteAll, progress, total, results };
};
