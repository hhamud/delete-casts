import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar as InkProgressBar } from '@inkjs/ui';

interface Props {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<Props> = ({ current, total }) => {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  
  return (
    <Box flexDirection="column" gap={1} borderStyle="round" padding={1} borderColor="cyan">
      <Text bold>Deleting Casts...</Text>
      <Box width={40}>
         <InkProgressBar value={percent} />
      </Box>
      <Text>{current} / {total} ({percent}%)</Text>
    </Box>
  );
};
