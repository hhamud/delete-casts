import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  createSigner,
  deleteCast,
  deleteReaction,
  getCastsByFid,
  getReactionsByFid,
  resetFetchImplementation,
  setFetchImplementation,
} from '../src/lib/farcaster.js';
import { clearConfigCache } from '../src/lib/config.js';
import { FarcasterError } from '../src/lib/errors.js';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_CAST_HASH = `0x${'11'.repeat(20)}`;
const TEST_REACTION_HASH = `0x${'22'.repeat(20)}`;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const textResponse = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });

describe('farcaster HTTP client', () => {
  beforeEach(() => {
    clearConfigCache();
    resetFetchImplementation();
  });

  afterEach(() => {
    clearConfigCache();
    resetFetchImplementation();
  });

  test('maps casts from the public HTTP payload', async () => {
    const fetchMock = mock(async () =>
      jsonResponse({
        messages: [
          {
            data: {
              type: 'MESSAGE_TYPE_CAST_ADD',
              timestamp: 5,
              castAddBody: {
                text: 'Hello world',
                parentCastId: {
                  fid: 7,
                  hash: TEST_CAST_HASH,
                },
              },
            },
            hash: TEST_CAST_HASH,
          },
          {
            data: {
              type: 'MESSAGE_TYPE_REACTION_ADD',
              reactionBody: {
                type: 'REACTION_TYPE_LIKE',
              },
            },
            hash: TEST_REACTION_HASH,
          },
        ],
      }),
    );

    setFetchImplementation(fetchMock as typeof fetch);

    await expect(getCastsByFid(12345)).resolves.toEqual([
      {
        hash: TEST_CAST_HASH,
        text: 'Hello world',
        timestamp: 1609459205000,
        isReply: true,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('paginates cast requests until nextPageToken is exhausted', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('pageToken=page-2')) {
        return jsonResponse({
          messages: [
            {
              data: {
                type: 'MESSAGE_TYPE_CAST_ADD',
                timestamp: 2,
                castAddBody: { text: 'second page' },
              },
              hash: `0x${'33'.repeat(20)}`,
            },
          ],
        });
      }

      return jsonResponse({
        messages: [
          {
            data: {
              type: 'MESSAGE_TYPE_CAST_ADD',
              timestamp: 1,
              castAddBody: { text: 'first page' },
            },
            hash: TEST_CAST_HASH,
          },
        ],
        nextPageToken: 'page-2',
      });
    });

    setFetchImplementation(fetchMock as typeof fetch);

    const casts = await getCastsByFid(12345);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(casts.map((cast) => cast.text)).toEqual(['first page', 'second page']);
  });

  test('maps likes and recasts from the public HTTP payload', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('reaction_type=Like')) {
        return jsonResponse({
          messages: [
            {
              data: {
                type: 'MESSAGE_TYPE_REACTION_ADD',
                reactionBody: {
                  type: 'REACTION_TYPE_LIKE',
                  targetCastId: {
                    fid: 99,
                    hash: TEST_CAST_HASH,
                  },
                },
              },
              hash: TEST_REACTION_HASH,
            },
          ],
        });
      }

      return jsonResponse({
        messages: [
          {
            data: {
              type: 'MESSAGE_TYPE_REACTION_ADD',
              reactionBody: {
                type: 'REACTION_TYPE_RECAST',
                targetCastId: {
                  fid: 100,
                  hash: `0x${'44'.repeat(20)}`,
                },
              },
            },
            hash: `0x${'55'.repeat(20)}`,
          },
          {
            data: {
              type: 'MESSAGE_TYPE_REACTION_ADD',
              reactionBody: {
                type: 'REACTION_TYPE_RECAST',
                targetCastId: {
                  fid: 100,
                  hash: `0x${'44'.repeat(20)}`,
                },
              },
            },
            hash: `0x${'55'.repeat(20)}`,
          },
        ],
      });
    });

    setFetchImplementation(fetchMock as typeof fetch);

    await expect(getReactionsByFid(12345)).resolves.toEqual([
      {
        hash: TEST_REACTION_HASH,
        kind: 'like',
        targetCastId: {
          fid: 99,
          hash: TEST_CAST_HASH,
        },
        targetUrl: undefined,
      },
      {
        hash: `0x${'55'.repeat(20)}`,
        kind: 'recast',
        targetCastId: {
          fid: 100,
          hash: `0x${'44'.repeat(20)}`,
        },
        targetUrl: undefined,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('retries transient read errors before succeeding', async () => {
    let attempts = 0;
    const fetchMock = mock(async () => {
      attempts++;

      if (attempts < 3) {
        throw new Error('connect ETIMEDOUT crackle.farcaster.xyz');
      }

      return jsonResponse({ messages: [] });
    });

    setFetchImplementation(fetchMock as typeof fetch);

    await expect(getCastsByFid(12345)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('surfaces a FarcasterError for exhausted network retries', async () => {
    const fetchMock = mock(async () => {
      throw new Error('getaddrinfo ENOTFOUND crackle.farcaster.xyz');
    });

    setFetchImplementation(fetchMock as typeof fetch);

    const error = await getCastsByFid(12345).catch((err) => err);

    expect(error).toBeInstanceOf(FarcasterError);
    expect((error as Error).message).toContain('Network error:');
    expect((error as Error).message).toContain('ENOTFOUND');
  });

  test('submits cast removals over the public HTTP endpoint', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://crackle.farcaster.xyz:3381/v1/submitMessage');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/octet-stream' });
      expect(init?.body).toBeDefined();
      return new Response(null, { status: 200 });
    });

    setFetchImplementation(fetchMock as typeof fetch);

    const signer = createSigner(TEST_MNEMONIC);
    await expect(deleteCast(12345, TEST_CAST_HASH, signer)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('retries rate-limited cast removals before succeeding', async () => {
    let attempts = 0;
    const fetchMock = mock(async () => {
      attempts++;
      return attempts < 3
        ? textResponse('bad_request.rate_limited', 429)
        : new Response(null, { status: 200 });
    });

    setFetchImplementation(fetchMock as typeof fetch);

    const signer = createSigner(TEST_MNEMONIC);
    await expect(deleteCast(12345, TEST_CAST_HASH, signer)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('submits reaction removals over the public HTTP endpoint', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }));

    setFetchImplementation(fetchMock as typeof fetch);

    const signer = createSigner(TEST_MNEMONIC);
    await expect(
      deleteReaction(
        12345,
        {
          hash: TEST_REACTION_HASH,
          kind: 'like',
          targetCastId: {
            fid: 77,
            hash: TEST_CAST_HASH,
          },
        },
        signer,
      ),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('rejects reaction removal when the target is missing', async () => {
    const signer = createSigner(TEST_MNEMONIC);

    await expect(
      deleteReaction(
        12345,
        {
          hash: TEST_REACTION_HASH,
          kind: 'recast',
        },
        signer,
      ),
    ).rejects.toThrow(`Reaction ${TEST_REACTION_HASH} is missing targetCastId/targetUrl`);
  });
});
