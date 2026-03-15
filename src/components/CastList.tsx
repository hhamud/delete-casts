import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import type { CastItem, ReactionItem } from '../types/index.js';

interface Props {
  casts: CastItem[];
  reactions: ReactionItem[];
  onAction: (action: 'delete-all' | 'cancel') => void;
  loading: boolean;
}

export const CastList: React.FC<Props> = ({ casts, reactions, onAction, loading }) => {
  if (loading) {
    return (
      <Box padding={1}>
        <Text>Loading activity from Farcaster Hub...</Text>
      </Box>
    );
  }

  const replies = casts.filter((cast) => cast.isReply).length;
  const rootCasts = casts.length - replies;
  const likes = reactions.filter((reaction) => reaction.kind === 'like').length;
  const recasts = reactions.filter((reaction) => reaction.kind === 'recast').length;

  const options = [
    { label: 'Delete All Activity (casts, replies, likes, recasts)', value: 'delete-all' },
    { label: 'Cancel', value: 'cancel' },
  ];

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" padding={1} borderColor="yellow">
      <Text bold>Found activity for deletion</Text>
      <Text>Casts: {rootCasts}</Text>
      <Text>Replies: {replies}</Text>
      <Text>Likes: {likes}</Text>
      <Text>Recasts: {recasts}</Text>

      <Box flexDirection="column" marginY={1}>
        <Text underline>Cast preview (newest first):</Text>
        {casts.slice(0, 5).map((cast, index) => (
          <Text key={`${cast.hash}-${index}`} wrap="truncate" color="gray">
            - {new Date(cast.timestamp).toLocaleDateString()}: {cast.text.replace(/\n/g, ' ').substring(0, 60)}...
          </Text>
        ))}
        {casts.length === 0 && <Text color="gray">No casts found</Text>}
        {casts.length > 5 && <Text color="gray">... and {casts.length - 5} more</Text>}
      </Box>

      <Text>Select action:</Text>
      <Select options={options} onChange={(value) => onAction(value as 'delete-all' | 'cancel')} />
    </Box>
  );
};
