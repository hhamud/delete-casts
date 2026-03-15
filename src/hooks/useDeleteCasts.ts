import { useState, useCallback } from 'react';
import type { UserAuth, DeletionResult, CastItem, ReactionItem } from '../types/index.js';
import { createSigner, deleteCast, deleteReaction } from '../lib/farcaster.js';

export const useDeleteCasts = (auth: UserAuth | null) => {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<DeletionResult[]>([]);

  const deleteAll = useCallback(async (casts: CastItem[], reactions: ReactionItem[]) => {
    if (!auth) return;

    setTotal(casts.length + reactions.length);
    setProgress(0);
    setResults([]);

    const signer = createSigner(auth.recoveryPhrase, auth.signerPrivateKey);

    for (const reaction of reactions) {
      try {
        await deleteReaction(auth.fid, reaction, signer);
        setResults((prev) => [...prev, { success: true, hash: reaction.hash, kind: reaction.kind }]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setResults((prev) => [
          ...prev,
          { success: false, hash: reaction.hash, kind: reaction.kind, error: errorMessage },
        ]);
      }
      setProgress((prev) => prev + 1);
    }

    for (const cast of casts) {
      const kind = cast.isReply ? 'reply' : 'cast';
      try {
        await deleteCast(auth.fid, cast.hash, signer);
        setResults((prev) => [...prev, { success: true, hash: cast.hash, kind }]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setResults((prev) => [...prev, { success: false, hash: cast.hash, kind, error: errorMessage }]);
      }
      setProgress((prev) => prev + 1);
    }
  }, [auth]);

  return { deleteAll, progress, total, results };
};
