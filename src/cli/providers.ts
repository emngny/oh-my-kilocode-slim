import { DEFAULT_AGENT_MCPS } from '../config/agent-mcps';
import { CUSTOM_SKILLS } from './custom-skills';
import type { InstallConfig } from './types';

const SCHEMA_URL =
  'https://unpkg.com/@emngny/oh-my-kilocode-slim@latest/oh-my-kilocode-slim.schema.json';

export const GENERATED_PRESETS = ['custom'] as const;

// Model mappings by provider/preset.
export const MODEL_MAPPINGS = {
  custom: {
    chief: { model: '' },
    council: { model: '' },
    oracle: { model: '' },
    librarian: { model: '' },
    explorer: { model: '' },
    designer: { model: '' },
    fixer: { model: '' },
    observer: { model: '' },
  },
} as const;

export type PresetName = keyof typeof MODEL_MAPPINGS;
export type GeneratedPresetName = (typeof GENERATED_PRESETS)[number];

export function isPresetName(value: string): value is PresetName {
  return Object.hasOwn(MODEL_MAPPINGS, value);
}

export function getPresetNames(): PresetName[] {
  return Object.keys(MODEL_MAPPINGS) as PresetName[];
}

export function isGeneratedPresetName(
  value: string,
): value is GeneratedPresetName {
  return GENERATED_PRESETS.includes(value as GeneratedPresetName);
}

export function getGeneratedPresetNames(): GeneratedPresetName[] {
  return [...GENERATED_PRESETS];
}

export function generateLiteConfig(
  installConfig: InstallConfig,
): Record<string, unknown> {
  const preset = installConfig.preset ?? 'custom';
  if (!isGeneratedPresetName(preset)) {
    throw new Error(
      `Unsupported preset "${preset}". Available generated presets: ${getGeneratedPresetNames().join(', ')}`,
    );
  }

  const config: Record<string, unknown> = {
    $schema: SCHEMA_URL,
    preset,
    presets: {},
  };

  const createAgentConfig = (
    agentName: string,
    modelInfo: { model: string; variant?: string },
  ) => {
    const isChief = agentName === 'chief';

    const skills = isChief
      ? ['*']
      : [
          ...CUSTOM_SKILLS.filter(
            (s) =>
              s.allowedAgents.includes('*') ||
              s.allowedAgents.includes(agentName),
          ).map((s) => s.name),
        ];

    return {
      model: modelInfo.model,
      variant: modelInfo.variant,
      skills,
      mcps:
        DEFAULT_AGENT_MCPS[agentName as keyof typeof DEFAULT_AGENT_MCPS] ?? [],
    };
  };

  const buildPreset = (mappingName: PresetName) => {
    const mapping = MODEL_MAPPINGS[mappingName];
    return Object.fromEntries(
      Object.entries(mapping).map(([agentName, modelInfo]) => [
        agentName,
        createAgentConfig(agentName, modelInfo),
      ]),
    );
  };

  const presets = config.presets as Record<string, unknown>;
  for (const presetName of GENERATED_PRESETS) {
    presets[presetName] = buildPreset(presetName);
  }

  if (installConfig.hasTmux) {
    config.tmux = {
      enabled: true,
      layout: 'main-vertical',
      main_pane_size: 60,
    };
  }

  if (installConfig.companion === 'yes') {
    config.companion = {
      enabled: true,
      position: 'bottom-right',
      size: 'medium',
      gifPack: 'default',
      loopStyle: 'classic',
      speed: 1,
      debug: false,
    };
  }

  return config;
}
