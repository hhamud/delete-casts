import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { ErrorMessage } from './ErrorMessage.js';
import { CastList } from './CastList.js';
import { ConfirmDelete } from './ConfirmDelete.js';
import { ProgressBar } from './ProgressBar.js';
import { Success } from './Success.js';
import { useFarcaster } from '../hooks/useFarcaster.js';
import { useDeleteCasts } from '../hooks/useDeleteCasts.js';
import type { UserAuth, Screen } from '../types/index.js';
import { loadCredentialsFromEnv, envToUserAuth } from '../lib/envCredentials.js';

export const App = () => {
  const [screen, setScreen] = useState<Screen>('list');
  const [auth, setAuth] = useState<UserAuth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { casts, reactions, loading: loadingActivity, error: loadError } = useFarcaster(auth);
  const { deleteAll, progress, total, results } = useDeleteCasts(auth);

  useEffect(() => {
    const envCreds = loadCredentialsFromEnv();
    const userAuth = envToUserAuth(envCreds);

    if (userAuth) {
      setAuth(userAuth);
      setScreen('list');
    } else {
      setError(
        'Missing or invalid Farcaster credentials in .env file.\n\n' +
          'Required environment variables:\n' +
          '  FARCASTER_FID\n' +
          '  FARCASTER_RECOVERY_PHRASE\n\n' +
          'Create a .env file in the project root with your credentials.',
      );
      setScreen('error');
    }
  }, []);

  useEffect(() => {
    if (loadError) {
      setError(loadError);
      setScreen('error');
    }
  }, [loadError]);

  const handleListAction = (action: 'delete-all' | 'cancel') => {
    if (action === 'cancel') {
      process.exit(0);
    } else {
      setScreen('confirm');
    }
  };

  const handleConfirm = async (confirmed: boolean) => {
    if (!confirmed) {
      setScreen('list');
    } else {
      setScreen('progress');
      await deleteAll(casts, reactions);
      setScreen('success');
    }
  };

  return (
    <Box margin={1} flexDirection="column">
      {screen === 'error' && <ErrorMessage message={error || 'Unknown error'} />}

      {screen === 'list' && (
        <CastList
          casts={casts}
          reactions={reactions}
          loading={loadingActivity}
          onAction={handleListAction}
        />
      )}

      {screen === 'confirm' && (
        <ConfirmDelete
          casts={casts.filter((cast) => !cast.isReply).length}
          replies={casts.filter((cast) => cast.isReply).length}
          likes={reactions.filter((reaction) => reaction.kind === 'like').length}
          recasts={reactions.filter((reaction) => reaction.kind === 'recast').length}
          onConfirm={handleConfirm}
        />
      )}

      {screen === 'progress' && <ProgressBar current={progress} total={total} />}

      {screen === 'success' && <Success results={results} />}
    </Box>
  );
};
