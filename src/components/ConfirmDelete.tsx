import React from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';

interface Props {
  casts: number;
  replies: number;
  likes: number;
  recasts: number;
  onConfirm: (confirmed: boolean) => void;
}

export const ConfirmDelete: React.FC<Props> = ({ casts, replies, likes, recasts, onConfirm }) => {
  const options = [
    { label: 'No, cancel', value: 'no' },
    { label: 'Yes, delete everything', value: 'yes' },
  ];

  const total = casts + replies + likes + recasts;

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" padding={1} borderColor="red">
      <Text bold color="red">WARNING</Text>
      <Text>You are about to permanently delete {total} items:</Text>
      <Text>- Casts: {casts}</Text>
      <Text>- Replies: {replies}</Text>
      <Text>- Likes: {likes}</Text>
      <Text>- Recasts: {recasts}</Text>
      <Text>This action cannot be undone.</Text>

      <Box marginTop={1}>
        <Select options={options} onChange={(val) => onConfirm(val === 'yes')} />
      </Box>
    </Box>
  );
};
