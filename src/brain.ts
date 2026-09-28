import { invoke } from "@tauri-apps/api/core";

export type BrainMode = "local" | "hermes" | "ollama" | "auto";

export type PublicBrainConfig = {
  mode: BrainMode;
  hermesUrl: string;
  hermesKeySet: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  fallbackToOllama: boolean;
  sessionKey: string;
};

export type ProviderStatus = {
  online: boolean;
  label: string;
  detail: string;
};

export type BrainStatus = {
  activeMode: BrainMode;
  hermes: ProviderStatus;
  ollama: ProviderStatus;
  config: PublicBrainConfig;
};

export type BrainReply = {
  provider: "hermes" | "ollama";
  content: string;
  fallbackUsed: boolean;
};

export const defaultBrainConfig: PublicBrainConfig = {
  mode: "local",
  hermesUrl: "http://127.0.0.1:8642/v1",
  hermesKeySet: false,
  ollamaUrl: "http://127.0.0.1:11434/v1",
  ollamaModel: "qwen3.5:latest",
  fallbackToOllama: true,
  sessionKey: "ai-creatures:miko"
};

export async function loadBrainConfig() {
  return invoke<PublicBrainConfig>("get_brain_config");
}

export async function saveBrainConfig(
  config: PublicBrainConfig,
  hermesApiKey?: string
) {
  return invoke<PublicBrainConfig>("save_brain_config", {
    input: {
      mode: config.mode,
      hermesUrl: config.hermesUrl,
      hermesApiKey: hermesApiKey?.trim() || null,
      ollamaUrl: config.ollamaUrl,
      ollamaModel: config.ollamaModel,
      fallbackToOllama: config.fallbackToOllama,
      sessionKey: config.sessionKey
    }
  });
}

export async function loadBrainStatus() {
  return invoke<BrainStatus>("brain_status");
}

export async function askBrain(systemPrompt: string, userPrompt: string) {
  return invoke<BrainReply>("brain_chat", {
    request: {
      systemPrompt,
      userPrompt
    }
  });
}
