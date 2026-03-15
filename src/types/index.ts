export type Screen = 'list' | 'confirm' | 'progress' | 'success' | 'error';

export interface UserAuth {
  fid: number;
  recoveryPhrase: string;
  signerPrivateKey?: string;
}

export interface EnvCredentials {
  fid: number | null;
  recoveryPhrase: string | null;
  signerPrivateKey: string | null;
}

export interface CastItem {
  hash: string;
  text: string;
  timestamp: number;
  isReply: boolean;
}

export type ReactionKind = 'like' | 'recast';

export interface ReactionTargetCastId {
  fid: number;
  hash: string;
}

export interface ReactionItem {
  hash: string;
  kind: ReactionKind;
  targetCastId?: ReactionTargetCastId;
  targetUrl?: string;
}

export interface DeletionResult {
  success: boolean;
  hash: string;
  kind: 'cast' | 'reply' | ReactionKind;
  error?: string;
}
