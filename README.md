# Delete Casts CLI

Terminal UI for bulk deleting Farcaster activity over the public HTTP hub.

## What It Deletes

- Casts
- Replies
- Likes
- Recasts

## Requirements

- Bun
- A Farcaster FID
- Your recovery phrase
- A registered Farcaster signer key exported from Warpcast
- A small amount of ETH on Optimism if you need to create or register another signer

## Install

```bash
git clone <repo>
cd delete-casts
bun install
```

## Credentials

Create a `.env` file in the project root:

```bash
FARCASTER_FID=1234
FARCASTER_RECOVERY_PHRASE="your 12 or 24 word recovery phrase"
FARCASTER_SIGNER_PRIVATE_KEY="0x..."
```

`FARCASTER_SIGNER_PRIVATE_KEY` should be the Ed25519 signer key exported from Warpcast. The tool can derive a key from the recovery phrase if needed, but deletion only works when the signer is actually registered to your FID.

If you need to create or register a new signer in Warpcast, keep some ETH on Optimism available for the registration gas fee.

## Configuration

The CLI talks to the public Farcaster HTTP hub by default:

```yaml
hub:
  url: https://crackle.farcaster.xyz:3381
```

You can override that in `config.yaml`, but the codebase is HTTP-only now. There is no gRPC or local snapchain path.

## Run

```bash
bun start
```

The UI fetches your activity, shows a confirmation screen, then deletes everything in sequence.

For unattended runs:

```bash
bun run dry-run
bun run cron
```

`bun run dry-run` fetches activity and prints the counts without submitting deletions. `bun run cron` runs non-interactively and deletes everything it fetched.

## Cron

Example Sunday-midnight cron entry:

```cron
CRON_TZ=Europe/London
0 0 * * 0 cd /home/hamza/projects/delete-casts && /home/hamza/.bun/bin/bun run cron >> /home/hamza/projects/delete-casts/cron.log 2>&1
```

## Test

```bash
bun test
```

## Troubleshooting

### Signer errors

If deletion fails with a signer-related error, verify that the signer key in `.env` is the registered Farcaster signer for that FID.
Creating or registering another signer also requires ETH on Optimism for gas.

### Rate limiting or temporary network failures

The HTTP client retries transient read and submit failures automatically, but persistent hub-side errors will still surface in the UI.
