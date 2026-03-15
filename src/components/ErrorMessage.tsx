import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  message: string;
}

export const ErrorMessage: React.FC<Props> = ({ message }) => {
  return (
    <Box flexDirection="column" gap={1} borderStyle="round" padding={1} borderColor="red">
      <Text bold color="red">❌ Error</Text>
      <Text>{message}</Text>
    </Box>
  );
};
