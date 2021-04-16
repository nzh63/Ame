import type sharp from 'sharp';
import type { OCRProviderConfig } from '@main/providers/OCRProvider';
import { availableOCRConfigs, AvailableOCRConfigs } from '@main/providers/ocr';
import { OCRProvider } from '@main/providers';
import { BaseManager } from '@main/manager/BaseManager';

type OCRCallback = (err: any, res: { providerId: string, img: sharp.Sharp, text: string }) => void;

export class OCRManager extends BaseManager<
    OCRProviderConfig<
        AvailableOCRConfigs[number]['id'],
        AvailableOCRConfigs[number]['optionsSchema'],
        ReturnType<AvailableOCRConfigs[number]['data']>
    >,
    OCRProvider<string>
> {
    private static instance: null | OCRManager = null;
    static getInstance() {
        if (!OCRManager.instance) OCRManager.instance = new OCRManager();
        return OCRManager.instance;
    }

    constructor() {
        super(availableOCRConfigs, OCRProvider);
    }

    public recognize(img: sharp.Sharp, callback: OCRCallback) {
        for (const provider of this.providers) {
            if (!provider.isReady()) continue;
            provider.recognize(img)
                .then(text => callback(undefined, { providerId: provider.id, img, text }))
                .catch((e) => callback(e, { providerId: provider.id, img, text: '' }));
        }
    }
}
