export class FarcasterError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'FarcasterError';
  }
}
