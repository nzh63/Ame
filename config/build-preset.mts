export type Preset = 'development' | 'production' | 'e2e';

export interface BuildFlags {
  LOGGING: boolean;
  RESOURCE_MODE: 'dev-server' | 'unpacked' | 'packed';
  ENABLE_ECHO_TRANSLATOR: boolean;
  CHECK_UPDATES: boolean;
  TEMP_STORE: boolean;
}

const PRESETS: Record<Preset, BuildFlags> = {
  development: {
    LOGGING: true,
    RESOURCE_MODE: 'dev-server',
    ENABLE_ECHO_TRANSLATOR: true,
    CHECK_UPDATES: false,
    TEMP_STORE: false,
  },
  production: {
    LOGGING: false,
    RESOURCE_MODE: 'packed',
    ENABLE_ECHO_TRANSLATOR: false,
    CHECK_UPDATES: true,
    TEMP_STORE: false,
  },
  e2e: {
    LOGGING: false,
    RESOURCE_MODE: 'unpacked',
    ENABLE_ECHO_TRANSLATOR: false,
    CHECK_UPDATES: false,
    TEMP_STORE: true,
  },
};

export function resolveFlags(preset: Preset): BuildFlags {
  return PRESETS[preset];
}

export function defineFlags(preset: Preset, extra?: Record<string, string | boolean>): Record<string, string> {
  const flags = resolveFlags(preset);
  return {
    'import.meta.env.LOGGING': JSON.stringify(flags.LOGGING),
    'import.meta.env.RESOURCE_MODE': JSON.stringify(flags.RESOURCE_MODE),
    'import.meta.env.ENABLE_ECHO_TRANSLATOR': JSON.stringify(flags.ENABLE_ECHO_TRANSLATOR),
    'import.meta.env.CHECK_UPDATES': JSON.stringify(flags.CHECK_UPDATES),
    'import.meta.env.TEMP_STORE': JSON.stringify(flags.TEMP_STORE),
    ...Object.fromEntries(
      Object.entries(extra ?? {}).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
  };
}
