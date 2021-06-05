declare namespace Electron {
    interface IpcMain {
        handle(channel: 'start-game', listener: (event: IpcMainInvokeEvent, arg: Ame.GameSetting) => Promise<Ame.IpcRet<{ pids: number[] }>>): void;
        handle(channel: 'show-open-dialog', listener: (event: IpcMainInvokeEvent, options: OpenDialogOptions) => Promise<Ame.IpcRet<void | string>>): void;
        handle(channel: 'get-all-extract-text', listener: (event: IpcMainInvokeEvent) => Ame.IpcRet<Ame.Extractor.Result>): void;
        handle(channel: 'start-extract', listener: (event: IpcMainInvokeEvent, arg: { gamePids: number[], hookCode?: string, type?: string }) => Promise<Ame.IpcRet<void>>): void;
        handle(channel: 'get-extractor-type', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcRet<Ame.Extractor.ExtractorType>>): void;
        handle(channel: 'switch-extractor-type', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcRet<void>>): void;
        handle(channel: 'get-screen-capture', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcRet<Buffer>>): void;
        handle(channel: 'get-screen-capture-crop-rect', listener: (event: IpcMainInvokeEvent) => Promise<Ame.IpcRet<import('sharp').Region | undefined>>): void;
        handle(channel: 'set-screen-capture-crop-rect', listener: (event: IpcMainInvokeEvent, rect: sharp.Region) => Promise<Ame.IpcRet<void>>): void;
        handle(channel: 'watch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'unwatch-original', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'watch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
        handle(channel: 'unwatch-translate', listener: (event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => Ame.IpcRet<void>): void;
    }

    interface IpcRenderer {
        invoke(channel: 'start-game', arg: Ame.GameSetting): Promise<Ame.IpcRet<{ pids: number[] }>>;
        invoke(channel: 'show-open-dialog', arg: OpenDialogOptions): Promise<Ame.IpcRet<void | string>>;
        invoke(channel: 'get-all-extract-text'): Promise<Ame.IpcRet<Ame.Extractor.Result>>;
        invoke(channel: 'start-extract', arg: { gamePids: number[], hookCode?: string, type?: string }): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'get-extractor-type'): Promise<Ame.IpcRet<Ame.Extractor.ExtractorType>>;
        invoke(channel: 'switch-extractor-type', type: Ame.Extractor.ExtractorType): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'get-screen-capture', force?: boolean): Promise<Ame.IpcRet<Buffer>>;
        invoke(channel: 'get-screen-capture-crop-rect'): Promise<Ame.IpcRet<import('sharp').Region | undefined>>;
        invoke(channel: 'set-screen-capture-crop-rect', rect: sharp.Region): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'get-screen-capture-preprocess-option'): Promise<Ame.IpcRet<import('@main/extractor/OcrExtractor').PreprocessOption>>;
        invoke(channel: 'get-textractor-post-process-option'): Promise<Ame.IpcRet<import('@main/extractor/Textractor').PostProcessOption>>;
        invoke(channel: 'watch-original', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'unwatch-original', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'watch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke(channel: 'unwatch-translate', key: Ame.Extractor.Key): Promise<Ame.IpcRet<void>>;
        invoke<T extends Ame.Provider.type>(channel: `get-${T}-providers-ids`): Promise<Ame.IpcRet<string[]>>;
        invoke<T extends Ame.Provider.type>(channel: `get-${T}-provider-options-meta`, id: string): Promise<Ame.IpcRet<Ame.Provider.meta>>;
        invoke(channel: 'segment', text: string): Promise<Ame.IpcRet<import('@main/manager/SegmentManager').SegmentWord[] | void>>;
        on(channel: 'original-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.OriginalText) => void): void;
        on(channel: 'translate-watch-list-update', listener: (event: IpcRendererEvent, arg: Ame.Translator.TranslateResult) => void): void;
    }

}
