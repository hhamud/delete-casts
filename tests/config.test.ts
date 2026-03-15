import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { clearConfigCache, getConfigPath, getHubUrl, loadConfig } from '../src/lib/config.js';

describe('Config', () => {
  const testConfigPath = path.resolve(process.cwd(), 'test-config.yaml');

  const validConfig = `
hub:
  url: "https://hub.example.com:3381"

app:
  fid: 12345
  debug: true
  page_size: 50

network:
  timeout: 5000
  retries: 5
  retry_delay: 500

features:
  preview: false
  confirm_delete: false
  progress_tracking: false

logging:
  level: "debug"
  timestamps: false
  file: "/tmp/test.log"
`;

  beforeEach(() => {
    clearConfigCache();
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    clearConfigCache();
  });

  test('loads default config when no config file exists', () => {
    const config = loadConfig('/nonexistent/path.yaml');

    expect(config.hub.url).toBe('https://crackle.farcaster.xyz:3381');
    expect(config.app.debug).toBe(false);
    expect(config.app.page_size).toBe(100);
    expect(config.network.timeout).toBe(30000);
    expect(config.features.preview).toBe(true);
    expect(config.logging.level).toBe('info');
  });

  test('loads config from YAML file', () => {
    fs.writeFileSync(testConfigPath, validConfig);

    const config = loadConfig(testConfigPath);

    expect(config.hub.url).toBe('https://hub.example.com:3381');
    expect(config.app.fid).toBe(12345);
    expect(config.app.debug).toBe(true);
    expect(config.app.page_size).toBe(50);
    expect(config.network.timeout).toBe(5000);
    expect(config.network.retries).toBe(5);
    expect(config.network.retry_delay).toBe(500);
    expect(config.features.preview).toBe(false);
    expect(config.features.confirm_delete).toBe(false);
    expect(config.features.progress_tracking).toBe(false);
    expect(config.logging.level).toBe('debug');
    expect(config.logging.timestamps).toBe(false);
    expect(config.logging.file).toBe('/tmp/test.log');
  });

  test('caches config after first load', () => {
    fs.writeFileSync(testConfigPath, validConfig);

    const config1 = loadConfig(testConfigPath);
    fs.writeFileSync(testConfigPath, 'hub:\n  url: "https://modified.example.com:3381"');
    const config2 = loadConfig(testConfigPath);

    expect(config1.hub.url).toBe('https://hub.example.com:3381');
    expect(config2.hub.url).toBe('https://hub.example.com:3381');
  });

  test('clears cache when requested', () => {
    fs.writeFileSync(testConfigPath, validConfig);

    const config1 = loadConfig(testConfigPath);
    clearConfigCache();
    fs.writeFileSync(testConfigPath, 'hub:\n  url: "https://modified.example.com:3381"');
    const config2 = loadConfig(testConfigPath);

    expect(config1.hub.url).toBe('https://hub.example.com:3381');
    expect(config2.hub.url).toBe('https://modified.example.com:3381');
  });

  test('handles invalid YAML gracefully', () => {
    const config = loadConfig(testConfigPath);
    expect(config.hub.url).toBe('https://crackle.farcaster.xyz:3381');
  });

  test('getHubUrl returns the configured HTTP endpoint', () => {
    fs.writeFileSync(testConfigPath, 'hub:\n  url: "https://gethuburl.example.com:3381"');
    expect(getHubUrl(testConfigPath)).toBe('https://gethuburl.example.com:3381');
  });

  test('getConfigPath returns config.yaml in the current working directory', () => {
    expect(getConfigPath()).toBe(path.resolve(process.cwd(), 'config.yaml'));
  });
});
