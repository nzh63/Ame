declare namespace Ame {
    export type GameSetting = {
        name: string;
        path: string;
        execShell: string;
        type: Ame.Extractor.ExtractorType;
        hookCode: string;
    };
    export type IpcRet<T> = { err: any } | { value: T };

    namespace Extractor {
        export type ExtractorType = 'textractor' | 'ocr';
        export type Key = string | 'any';
        export type Result = { [key in Ame.Extractor.Key]: string };
    }

    namespace Translator {
        export type OriginalText = { key: Ame.Extractor.Key, text: string };
        export type TranslateResult = { key: Ame.Extractor.Key, originalText: string, translateText: string, providerId: string };
    }
}
