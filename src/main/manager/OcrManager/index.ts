import type sharp from 'sharp';
import { availableOcrConfigs } from '@main/providers/ocr';
import { OcrProvider } from '@main/providers';
import { BaseManager } from '@main/manager/BaseManager';

type OcrCallback = (err: any, res: { providerId: string, img: sharp.Sharp, text: string }) => void;

export class OcrManager extends BaseManager<OcrProvider> {
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
