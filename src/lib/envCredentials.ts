import type { UserAuth } from '../types/index.js';

export interface EnvCredentials {
  fid: number | null;
  recoveryPhrase: string | null;
  signerPrivateKey: string | null;
}

export function envToUserAuth(creds: EnvCredentials): UserAuth | null {
  if (!creds.fid) {
    return null;
  }
  const trimmedFid = creds.fid.toString().trim();
  const trimmedMnemonic = creds.recoveryPhrase ? creds.recoveryPhrase.trim() : '';
  
  if (!trimmedMnemonic || trimmedMnemonic === '') {
    return null;
  }
  
  return {
    fid: parseInt(trimmedFid),
    recoveryPhrase: trimmedMnemonic,
    signerPrivateKey: creds.signerPrivateKey || undefined,
  };
}

export function loadCredentialsFromEnv(): EnvCredentials {
  // Bun automatically loads .env files
  const fidValue = Bun.env.FARCASTER_FID;
  const recoveryPhrase = Bun.env.FARCASTER_RECOVERY_PHRASE;
  const signerPrivateKey = Bun.env.FARCASTER_SIGNER_PRIVATE_KEY?.trim();
  
  const fid = fidValue ? parseInt(fidValue, 10) : null;
  
  return {
    fid: isNaN(fid ?? NaN) ? null : fid,
    recoveryPhrase: recoveryPhrase?.trim() || null,
    signerPrivateKey: signerPrivateKey || null,
  };
}
