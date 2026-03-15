import React from 'react';
import { Box, Text } from 'ink';
import type { DeletionResult } from '../types/index.js';

interface Props {
  results: DeletionResult[];
}

export const Success: React.FC<Props> = ({ results }) => {
  const total = results.length;
  const successCount = results.filter((result) => result.success).length;
  const failCount = total - successCount;

  const byKind = {
    cast: results.filter((result) => result.kind === 'cast' && result.success).length,
    reply: results.filter((result) => result.kind === 'reply' && result.success).length,
    like: results.filter((result) => result.kind === 'like' && result.success).length,
    recast: results.filter((result) => result.kind === 'recast' && result.success).length,
  };

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" padding={1} borderColor="green">
      <Text bold color="green">Operation Complete</Text>
      <Text>Processed: {total}</Text>
      <Text>Successfully deleted: {successCount}</Text>
      {failCount > 0 && <Text color="red">Failed: {failCount}</Text>}
      <Text>Casts deleted: {byKind.cast}</Text>
      <Text>Replies deleted: {byKind.reply}</Text>
      <Text>Likes removed: {byKind.like}</Text>
      <Text>Recasts removed: {byKind.recast}</Text>

      {failCount > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text underline>Errors:</Text>
          {results
            .filter((result) => !result.success)
            .slice(0, 5)
            .map((result, index) => (
              <Text key={`${result.kind}-${result.hash}-${index}`} color="red">
                - [{result.kind}] {result.hash}: {result.error}
              </Text>
            ))}
          {failCount > 5 && <Text>...and {failCount - 5} more</Text>}
        </Box>
      )}
    </Box>
  );
};
