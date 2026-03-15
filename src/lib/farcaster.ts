import {
  NobleEd25519Signer,
  makeCastRemove,
  makeReactionRemove,
  Message,
  MessageType,
  FarcasterNetwork,
  ReactionType,
} from '@farcaster/core';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import type { CastItem, ReactionItem } from '../types/index.js';
import { FarcasterError } from './errors.js';
import { logger } from './logger.js';
import { getHubUrl } from './config.js';

const FARCASTER_EPOCH = 1609459200000;
const FARCASTER_PATH = "m/44'/60'/0'/0/0";
const MAX_PAGES = 100;
const MAX_HTTP_RETRIES = 5;
const RETRIABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type HubResponse = {
  messages?: any[];
  nextPageToken?: string;
};

type FetchImplementation = typeof fetch;

let overrideFetch: FetchImplementation | null = null;

const bytesToHexHash = (hash: Uint8Array): string => {
  return `0x${Buffer.from(hash).toString('hex')}`;
};

const normalizeHash = (hash: string | Uint8Array | undefined | null): string => {
  if (!hash) {
    throw new FarcasterError('Missing message hash');
  }

  return typeof hash === 'string' ? hash : bytesToHexHash(hash);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getFetchImplementation = () => {
  return overrideFetch ?? fetch;
};

const getNormalizedHubUrl = () => {
  const configured = getHubUrl();
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
};

const buildHubUrl = (pathWithQuery: string) => {
  const url = new URL(pathWithQuery, `${getNormalizedHubUrl()}/`);
  return url.toString();
};

const isCastAddType = (type: unknown) =>
  type === MessageType.CAST_ADD || type === 'MESSAGE_TYPE_CAST_ADD' || type === 1;

const isReactionAddType = (type: unknown) =>
  type === MessageType.REACTION_ADD || type === 'MESSAGE_TYPE_REACTION_ADD' || type === 3;

const isLikeReactionType = (type: unknown) =>
  type === ReactionType.LIKE || type === 'REACTION_TYPE_LIKE' || type === 1;

const isRecastReactionType = (type: unknown) =>
  type === ReactionType.RECAST || type === 'REACTION_TYPE_RECAST' || type === 2;

const isRetriableError = (err: Error) => {
  const message = err.message.toLowerCase();

  return (
    message.includes('connect') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('econnreset') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('tls') ||
    message.includes('dns:') ||
    message.includes('name resolution failed')
  );
};

const toReadableError = (err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  return err instanceof Error && isRetriableError(err)
    ? `Network error: ${errorMessage}`
    : `Unexpected error: ${errorMessage}`;
};

const fetchHub = async (pathWithQuery: string, init?: RequestInit): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt++) {
    try {
      const response = await getFetchImplementation()(buildHubUrl(pathWithQuery), init);

      if (response.ok) {
        return response;
      }

      const responseText = await response.text();
      const error = new FarcasterError(
        `HTTP hub error (${response.status}): ${responseText || response.statusText}`,
      );
      const isRetriable =
        RETRIABLE_STATUS_CODES.has(response.status) || responseText.includes('bad_request.rate_limited');

      if (!isRetriable || attempt === MAX_HTTP_RETRIES) {
        throw error;
      }

      lastError = error;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');

      if (!isRetriableError(error) || attempt === MAX_HTTP_RETRIES) {
        throw error;
      }

      lastError = error;
    }

    await sleep(300 * attempt);
  }

  throw lastError ?? new FarcasterError('HTTP hub request failed');
};

const fetchAllHttpMessages = async (pathWithQuery: string) => {
  const allMessages: any[] = [];
  let nextPageToken = '';
  let pageCount = 0;

  do {
    const response = await fetchHub(
      nextPageToken ? `${pathWithQuery}&pageToken=${encodeURIComponent(nextPageToken)}` : pathWithQuery,
    );
    const payload = (await response.json()) as HubResponse;
    const messages = payload.messages ?? [];

    allMessages.push(...messages);
    nextPageToken = payload.nextPageToken ?? '';
    pageCount++;

    if (pageCount >= MAX_PAGES) {
      console.warn(`Reached maximum page limit (${MAX_PAGES}), stopping pagination`);
      break;
    }
  } while (nextPageToken);

  return allMessages;
};

const submitMessageHttp = async (message: Parameters<typeof Message.encode>[0]) => {
  const bytes = Buffer.from(Message.encode(message).finish());

  await fetchHub('/v1/submitMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });

  return true;
};

const mnemonicToPrivateKey = (mnemonic: string): Buffer => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdkey = HDKey.fromMasterSeed(seed);
  const childKey = hdkey.derive(FARCASTER_PATH);

  if (!childKey.privateKey) {
    throw new Error('Failed to derive private key from recovery phrase');
  }

  return Buffer.from(childKey.privateKey);
};

export const createSigner = (recoveryPhrase: string, signerPrivateKey?: string) => {
  if (signerPrivateKey) {
    const privateKeyBytes = Buffer.from(signerPrivateKey.slice(2), 'hex');
    return new NobleEd25519Signer(privateKeyBytes);
  }

  return new NobleEd25519Signer(mnemonicToPrivateKey(recoveryPhrase));
};

export const getCastsByFid = async (fid: number): Promise<CastItem[]> => {
  try {
    const messages = await fetchAllHttpMessages(`/v1/castsByFid?fid=${fid}`);
    const casts: CastItem[] = [];

    for (const msg of messages) {
      if (!isCastAddType(msg?.data?.type) || !msg?.data?.castAddBody) {
        continue;
      }

      casts.push({
        hash: normalizeHash(msg.hash),
        text: msg.data.castAddBody.text,
        timestamp: (msg.data.timestamp || 0) * 1000 + FARCASTER_EPOCH,
        isReply: !!msg.data.castAddBody.parentCastId || !!msg.data.castAddBody.parentUrl,
      });
    }

    return casts;
  } catch (err) {
    logger.error('Error fetching casts', { error: err, fid, hubUrl: getHubUrl() });
    throw new FarcasterError(toReadableError(err), err);
  }
};

export const getReactionsByFid = async (fid: number): Promise<ReactionItem[]> => {
  try {
    const reactions: ReactionItem[] = [];
    const seenHashes = new Set<string>();

    const [likeMessages, recastMessages] = await Promise.all([
      fetchAllHttpMessages(`/v1/reactionsByFid?fid=${fid}&reaction_type=Like`),
      fetchAllHttpMessages(`/v1/reactionsByFid?fid=${fid}&reaction_type=Recast`),
    ]);

    for (const msg of [...likeMessages, ...recastMessages]) {
      if (!isReactionAddType(msg?.data?.type) || !msg?.data?.reactionBody) {
        continue;
      }

      const kind = isLikeReactionType(msg.data.reactionBody.type)
        ? 'like'
        : isRecastReactionType(msg.data.reactionBody.type)
          ? 'recast'
          : null;

      if (!kind) {
        continue;
      }

      const hash = normalizeHash(msg.hash);
      if (seenHashes.has(hash)) {
        continue;
      }

      seenHashes.add(hash);

      reactions.push({
        hash,
        kind,
        targetCastId: msg.data.reactionBody.targetCastId
          ? {
              fid: msg.data.reactionBody.targetCastId.fid,
              hash: normalizeHash(msg.data.reactionBody.targetCastId.hash),
            }
          : undefined,
        targetUrl: msg.data.reactionBody.targetUrl || undefined,
      });
    }

    return reactions;
  } catch (err) {
    logger.error('Error fetching reactions', { error: err, fid, hubUrl: getHubUrl() });
    throw new FarcasterError(toReadableError(err), err);
  }
};

export const deleteCast = async (fid: number, targetHash: string, signer: NobleEd25519Signer) => {
  const castRemove = await makeCastRemove(
    {
      targetHash: Buffer.from(targetHash.slice(2), 'hex'),
    },
    {
      fid,
      network: FarcasterNetwork.MAINNET,
    },
    signer,
  );

  if (castRemove.isErr()) {
    throw new FarcasterError('Failed to create CastRemove message', castRemove.error);
  }

  try {
    await submitMessageHttp(castRemove.value);
    return true;
  } catch (err) {
    logger.error('Failed to submit CastRemove message', {
      error: err,
      fid,
      targetHash,
      hubUrl: getHubUrl(),
    });

    throw new FarcasterError(`Failed to submit CastRemove message: ${toReadableError(err)}`, err);
  }
};

export const deleteReaction = async (fid: number, reaction: ReactionItem, signer: NobleEd25519Signer) => {
  const reactionBody: {
    type: ReactionType;
    targetCastId?: { fid: number; hash: Uint8Array };
    targetUrl?: string;
  } = {
    type: reaction.kind === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
  };

  if (reaction.targetCastId) {
    reactionBody.targetCastId = {
      fid: reaction.targetCastId.fid,
      hash: Buffer.from(reaction.targetCastId.hash.slice(2), 'hex'),
    };
  } else if (reaction.targetUrl) {
    reactionBody.targetUrl = reaction.targetUrl;
  } else {
    throw new FarcasterError(`Reaction ${reaction.hash} is missing targetCastId/targetUrl`);
  }

  const reactionRemove = await makeReactionRemove(
    reactionBody,
    {
      fid,
      network: FarcasterNetwork.MAINNET,
    },
    signer,
  );

  if (reactionRemove.isErr()) {
    throw new FarcasterError('Failed to create ReactionRemove message', reactionRemove.error);
  }

  try {
    await submitMessageHttp(reactionRemove.value);
    return true;
  } catch (err) {
    logger.error('Failed to submit ReactionRemove message', {
      error: err,
      fid,
      reactionHash: reaction.hash,
      reactionKind: reaction.kind,
      hubUrl: getHubUrl(),
    });

    throw new FarcasterError(`Failed to submit ReactionRemove message: ${toReadableError(err)}`, err);
  }
};

export const setFetchImplementation = (mockFetch: FetchImplementation) => {
  overrideFetch = mockFetch;
};

export const resetFetchImplementation = () => {
  overrideFetch = null;
};
