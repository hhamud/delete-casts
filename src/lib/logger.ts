import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE = path.join(process.cwd(), 'debug.log');

export const logger = {
  info: (msg: string) => {
    try {
      fs.appendFileSync(LOG_FILE, `[INFO] ${new Date().toISOString()} ${msg}\n`);
    } catch {}
  },
  error: (msg: string, err?: unknown) => {
    try {
      fs.appendFileSync(LOG_FILE, `[ERROR] ${new Date().toISOString()} ${msg} ${err ? JSON.stringify(err) : ''}\n`);
    } catch {}
  }
};
