declare namespace Electron {
    interface IpcMain {
        handle(channel: 'start-game', listener: (event: IpcMainInvokeEvent, arg: Ame.GameSetting) => Promise<Ame.IpcRet<{ pids: number[] }>>): void;
        handle(channel: 'show-open-dialog', listener: (event: IpcMainInvokeEvent, options: OpenDialogOptions) => Promise<Ame.IpcRet<void | string>>): void;
        handle(channel: 'get-all-extract-text', listener: (event: IpcMainInvokeEvent) => Ame.IpcRet<Ame.Extractor.Result>): void;
        handle(channel: 'start-extract', listener: (event: IpcMainInvokeEvent, arg: { gamePids: number[], hookCode?: string }) => Promise<Ame.IpcRet<void>>): this;
        handle(channel: 'watch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'unwatch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'watch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'unwatch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
    }

    interface IpcRenderer {
        invoke(channel: 'start-game', arg: Ame.GameSetting): Promise<Ame.IpcRet<{ pids: number[] }>>;
        invoke(channel: 'show-open-dialog', arg: OpenDialogOptions): Promise<Ame.IpcRet<void | string>>;
        invoke(channel: 'get-all-extract-text'): Promise<Ame.IpcRet<Ame.Extractor.Result>>;
        invoke(channel: 'start-extract', arg: { gamePids: number[], hookCode?: string }): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'watch-original', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'unwatch-original', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'watch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'unwatch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke<T extends 'translate' | 'tts' | 'ocr'>(channel: `get-${T}-providers-ids`): Promise<Ame.IpcRet<string[]>>;
        invoke<T extends 'translate' | 'tts' | 'ocr'>(channel: `get-${T}-provider-options-json-schema`, id: string): Promise<Ame.IpcRet<import('@main/schema').JSONSchema>>;
        on(channel: 'original-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.OriginalText) => void): void;
        on(channel: 'translate-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.TranslateResult) => void): void;
    }

}
