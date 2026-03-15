import * as fs from 'fs';
import * as path from 'path';
import { load } from 'js-yaml';

const DEFAULT_HUB_URL = 'https://crackle.farcaster.xyz:3381';

export interface HubConfig {
  url: string;
}

export interface AppConfig {
  fid?: number;
  debug: boolean;
  page_size: number;
}

export interface NetworkConfig {
  timeout: number;
  retries: number;
  retry_delay: number;
}

export interface FeaturesConfig {
  preview: boolean;
  confirm_delete: boolean;
  progress_tracking: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  timestamps: boolean;
  file?: string;
}

export interface Config {
  hub: HubConfig;
  app: AppConfig;
  network: NetworkConfig;
  features: FeaturesConfig;
  logging: LoggingConfig;
}

let cachedConfig: { path: string; config: Config } | null = null;

export const loadConfig = (configPath?: string): Config => {
  const defaultPath = path.resolve(process.cwd(), 'config.yaml');
  const filePath = configPath || defaultPath;

  if (cachedConfig && cachedConfig.path === filePath) {
    return cachedConfig.config;
  }

  let config: Partial<Config> = {};

  if (fs.existsSync(filePath)) {
    try {
      config = load(fs.readFileSync(filePath, 'utf8')) as Partial<Config>;
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${filePath}:`, error);
    }
  }

  const finalConfig: Config = {
    hub: {
      url: config.hub?.url || DEFAULT_HUB_URL,
    },
    app: {
      fid: config.app?.fid,
      debug: config.app?.debug || false,
      page_size: config.app?.page_size || 100,
    },
    network: {
      timeout: config.network?.timeout || 30000,
      retries: config.network?.retries || 3,
      retry_delay: config.network?.retry_delay || 1000,
    },
    features: {
      preview: config.features?.preview ?? true,
      confirm_delete: config.features?.confirm_delete ?? true,
      progress_tracking: config.features?.progress_tracking ?? true,
    },
    logging: {
      level: config.logging?.level || 'info',
      timestamps: config.logging?.timestamps ?? true,
      file: config.logging?.file,
    },
  };

  cachedConfig = { path: filePath, config: finalConfig };
  return finalConfig;
};

export const getHubUrl = (configPath?: string): string => {
  return loadConfig(configPath).hub.url;
};

export const clearConfigCache = (): void => {
  cachedConfig = null;
};

export const getConfigPath = (): string => {
  return path.resolve(process.cwd(), 'config.yaml');
};
