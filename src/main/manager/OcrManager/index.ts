import type sharp from 'sharp';
import type { OcrProviderConfig } from '@main/providers/OcrProvider';
import { availableOcrConfigs, AvailableOcrConfigs } from '@main/providers/ocr';
import { OcrProvider } from '@main/providers';
import { BaseManager } from '@main/manager/BaseManager';

type OcrCallback = (err: any, res: { providerId: string, img: sharp.Sharp, text: string }) => void;

export class OcrManager extends BaseManager<
    OcrProviderConfig<
        AvailableOcrConfigs[number]['id'],
        AvailableOcrConfigs[number]['optionsSchema'],
        ReturnType<AvailableOcrConfigs[number]['data']>
    >,
    OcrProvider<string>
> {
    constructor() {
        super(availableOcrConfigs, OcrProvider);
    }

    public recognize(img: sharp.Sharp, callback: OcrCallback) {
        for (const provider of this.providers) {
            if (!provider.isReady()) continue;
            provider.recognize(img)
                .then(text => callback(undefined, { providerId: provider.id, img, text }))
                .catch((e) => callback(e, { providerId: provider.id, img, text: '' }));
        }
    }
}
