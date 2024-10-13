declare namespace Electron {
    interface IpcMain {
        handle(channel: 'start-game', listener: (event: IpcMainInvokeEvent, arg: Ame.GameSetting) => Promise<Ame.IpcResult<{ pids: number[] }>>): void;
        handle(channel: 'show-open-dialog', listener: (event: IpcMainInvokeEvent, options: OpenDialogOptions) => Promise<Ame.IpcResult<void | string>>): void;
        handle(channel: 'get-all-extract-text', listener: (event: IpcMainInvokeEvent) => Ame.IpcResult<Ame.Extractor.Result>): void;
        handle(channel: 'start-extract', listener: (event: IpcMainInvokeEvent, arg: { gamePids: number[], hookCode?: string, type?: string }) => Promise<Ame.IpcResult<void>>): void;
        handle(channel: 'get-extractor-type', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcResult<Ame.Extractor.ExtractorType>>): void;
        handle(channel: 'switch-extractor-type', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcResult<void>>): void;
        handle(channel: 'get-screen-capture', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcResult<Buffer>>): void;
        handle(channel: 'get-preprocessed-image', listener: (event: IpcMainInvokeEvent, img: Buffer, option: PreprocessOption) => Promise<Ame.IpcResult<Buffer>>): void;
        handle(channel: 'get-screen-capture-crop-rect', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcResult<import('sharp').Region | undefined>>): void;
        handle(channel: 'set-screen-capture-crop-rect', listener: (event: IpcMainInvokeEvent, rect: sharp.Region) => Promise<Ame.IpcResult<void>>): void;
        handle(channel: 'watch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcResult<void>): void;
        handle(channel: 'unwatch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcResult<void>): void;
        handle(channel: 'watch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcResult<void>): void;
        handle(channel: 'unwatch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcResult<void>): void;
        handle(channel: 'find-window-by-click', listener: (event: IpcMainInvokeEvent) => Ame.IpcResult<number|undefined>): void;
        handle(channel: 'read-icon', listener: (event: IpcMainInvokeEvent, path: string) => Ame.IpcResult<string>): void;
    }

    interface IpcRenderer {
        invoke(channel: 'start-game', arg: Ame.GameSetting): Promise<Ame.IpcResult<{ pids: number[] }>>;
        invoke(channel: 'get-game-setting'): Promise<Ame.IpcResult<Ame.GameSetting | undefined>>;
        invoke(channel: 'set-game-select-keys', keys: Ame.GameSetting.Key[]): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'show-open-dialog', arg: OpenDialogOptions): Promise<Ame.IpcResult<void | string>>;
        invoke(channel: 'get-all-extract-text'): Promise<Ame.IpcResult<Ame.Extractor.Result>>;
        invoke(channel: 'start-extract', arg: { gamePids: number[], hookCode?: string, type?: string }): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'get-extractor-type'): Promise<Ame.IpcResult<Ame.Extractor.ExtractorType>>;
        invoke(channel: 'switch-extractor-type', type: Ame.Extractor.ExtractorType): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'get-screen-capture', force?: boolean): Promise<Ame.IpcResult<Buffer>>;
        invoke(channel: 'get-preprocessed-image', img: Buffer, option: PreprocessOption): Promise<Ame.IpcResult<Buffer>>;
        invoke(channel: 'get-screen-capture-crop-rect'): Promise<Ame.IpcResult<import('sharp').Region | undefined>>;
        invoke(channel: 'set-screen-capture-crop-rect', rect: sharp.Region): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'get-screen-capture-preprocess-option'): Promise<Ame.IpcResult<import('@main/extractor/OcrExtractor').PreprocessOption>>;
        invoke(channel: 'get-textractor-post-process-option'): Promise<Ame.IpcResult<import('@main/extractor/Textractor').PostProcessOption>>;
        invoke(channel: 'watch-original', key: Ame.Extractor.Key): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'unwatch-original', key: Ame.Extractor.Key): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'watch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcResult<void>>;
        invoke(channel: 'unwatch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcResult<void>>;
        invoke<T extends Ame.Provider.type>(channel: `get-${T}-providers-ids`): Promise<Ame.IpcResult<string[]>>;
        invoke<T extends Ame.Provider.type>(channel: `get-${T}-provider-options-meta`, id: string): Promise<Ame.IpcResult<Ame.Provider.meta>>;
        invoke(channel: 'segment', text: string): Promise<Ame.IpcResult<import('@main/manager/SegmentManager').SegmentWord[] | void>>;
        invoke(channel: 'find-window-by-click'): Promise<Ame.IpcResult<number|undefined>>;
        invoke(channel: 'read-icon', path: string): Promise<Ame.IpcResult<string>>;
        on(channel: 'original-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.OriginalText) => void): void;
        on(channel: 'translate-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.TranslateResult) => void): void;
        on(channel: 'window-focus', listener: (event: IpcRendererEvent) => void): void;
        on(channel: 'window-blur', listener: (event: IpcRendererEvent) => void): void;
    }

}
