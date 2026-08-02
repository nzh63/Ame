/** Shape of the persistent store, mirroring the Rust `Store` layout. */
export interface StoreType {
  store: {
    games: Ame.GameSetting[];
    localeChangers: {
      name: string;
      execShell: string;
      enable: boolean;
      placeholder?: string;
      editingName?: boolean;
    }[];
    translateProviders: Record<string, unknown>;
    ttsProviders: Record<string, unknown>;
    ocrProviders: Record<string, unknown>;
    segmentProviders: Record<string, unknown>;
    dictProviders: Record<string, unknown>;
    ttsManager: unknown;
    segmentManager: unknown;
    dictManager: unknown;
    ocrExtractor: unknown;
    ui: { fontSize?: number; [key: string]: unknown };
    [key: string]: unknown;
  };
}
