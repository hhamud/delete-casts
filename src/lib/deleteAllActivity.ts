import type { CastItem, DeletionResult, ReactionItem, UserAuth } from '../types/index.js';
import { createSigner, deleteCast, deleteReaction } from './farcaster.js';

export interface DeleteAllActivityProgress {
  completed: number;
  total: number;
}

export interface DeleteAllActivityOptions {
  onProgress?: (result: DeletionResult, progress: DeleteAllActivityProgress) => void;
}

export const deleteAllActivity = async (
  auth: UserAuth,
  casts: CastItem[],
  reactions: ReactionItem[],
  options: DeleteAllActivityOptions = {},
): Promise<DeletionResult[]> => {
  const signer = createSigner(auth.recoveryPhrase, auth.signerPrivateKey);
  const results: DeletionResult[] = [];
  const total = casts.length + reactions.length;
  let completed = 0;

  const recordResult = (result: DeletionResult) => {
    results.push(result);
    completed += 1;
    options.onProgress?.(result, { completed, total });
  };

  for (const reaction of reactions) {
    try {
      await deleteReaction(auth.fid, reaction, signer);
      recordResult({ success: true, hash: reaction.hash, kind: reaction.kind });
    } catch (err) {
      recordResult({
        success: false,
        hash: reaction.hash,
        kind: reaction.kind,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  for (const cast of casts) {
    const kind = cast.isReply ? 'reply' : 'cast';

    try {
      await deleteCast(auth.fid, cast.hash, signer);
      recordResult({ success: true, hash: cast.hash, kind });
    } catch (err) {
      recordResult({
        success: false,
        hash: cast.hash,
        kind,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
};
