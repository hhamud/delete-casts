#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { envToUserAuth, loadCredentialsFromEnv } from './lib/envCredentials.js';
import { getCastsByFid, getReactionsByFid } from './lib/farcaster.js';
import { deleteAllActivity } from './lib/deleteAllActivity.js';
import type { CastItem, DeletionResult, ReactionItem } from './types/index.js';

interface CliOptions {
  autoConfirm: boolean;
  dryRun: boolean;
  help: boolean;
}

const parseArgs = (): CliOptions => {
  const args = new Set(Bun.argv.slice(2));

  return {
    autoConfirm: args.has('--yes'),
    dryRun: args.has('--dry-run'),
    help: args.has('--help') || args.has('-h'),
  };
};

const getSummary = (casts: CastItem[], reactions: ReactionItem[]) => {
  const replies = casts.filter((cast) => cast.isReply).length;

  return {
    casts: casts.length - replies,
    replies,
    likes: reactions.filter((reaction) => reaction.kind === 'like').length,
    recasts: reactions.filter((reaction) => reaction.kind === 'recast').length,
  };
};

const printUsage = () => {
  console.log('Usage: bun src/cli.tsx [--yes] [--dry-run]');
  console.log('');
  console.log('  --yes      Run non-interactively and delete all fetched activity');
  console.log('  --dry-run  Run non-interactively, print what would be deleted, and exit');
};

const printSummary = (summary: ReturnType<typeof getSummary>) => {
  const total = summary.casts + summary.replies + summary.likes + summary.recasts;

  console.log(`Found ${total} items`);
  console.log(`- Casts: ${summary.casts}`);
  console.log(`- Replies: ${summary.replies}`);
  console.log(`- Likes: ${summary.likes}`);
  console.log(`- Recasts: ${summary.recasts}`);
};

const printResults = (results: DeletionResult[]) => {
  const total = results.length;
  const successCount = results.filter((result) => result.success).length;
  const failed = results.filter((result) => !result.success);

  console.log('');
  console.log(`Processed ${total} items`);
  console.log(`Succeeded: ${successCount}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Failures:');

    for (const result of failed.slice(0, 10)) {
      console.log(`- [${result.kind}] ${result.hash}: ${result.error}`);
    }

    if (failed.length > 10) {
      console.log(`...and ${failed.length - 10} more`);
    }
  }
};

const runHeadless = async (options: CliOptions) => {
  const auth = envToUserAuth(loadCredentialsFromEnv());

  if (!auth) {
    console.error('Missing or invalid Farcaster credentials in .env file.');
    console.error('Required environment variables: FARCASTER_FID, FARCASTER_RECOVERY_PHRASE');
    return 1;
  }

  const [casts, reactions] = await Promise.all([getCastsByFid(auth.fid), getReactionsByFid(auth.fid)]);
  const summary = getSummary(casts, reactions);
  const total = casts.length + reactions.length;

  printSummary(summary);

  if (options.dryRun) {
    console.log('');
    console.log('Dry run only. No deletions were submitted.');
    return 0;
  }

  if (!options.autoConfirm) {
    console.error('');
    console.error('Refusing to run headlessly without --yes.');
    return 1;
  }

  if (total === 0) {
    console.log('');
    console.log('Nothing to delete.');
    return 0;
  }

  console.log('');
  console.log('Starting deletion...');

  const results = await deleteAllActivity(auth, casts, reactions, {
    onProgress: (result, progress) => {
      const status = result.success ? 'ok' : 'fail';
      console.log(`[${progress.completed}/${progress.total}] ${status} ${result.kind} ${result.hash}`);
    },
  });

  printResults(results);
  return results.some((result) => !result.success) ? 1 : 0;
};

const main = async () => {
  const options = parseArgs();

  if (options.help) {
    printUsage();
    return;
  }

  if (options.autoConfirm || options.dryRun) {
    process.exitCode = await runHeadless(options);
    return;
  }

  render(<App />);
};

await main();
