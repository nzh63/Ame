import { availableSegmentConfigs } from '@main/providers/segment';
import { SegmentProvider } from '@main/providers';
import { SegmentManagerOptions } from '@main/manager/SegmentManager/options';
import { BaseManager } from '@main/manager/BaseManager';
import store from '@main/store';
import logger from '@logger/manager/segment';

export class SegmentManager extends BaseManager<SegmentProvider> {
    protected options: SegmentManagerOptions;

    constructor() {
        super(availableSegmentConfigs, SegmentProvider);
        this.options = store.get('segmentManager');
        store.onDidChange('ttsProviders', () => { this.options = store.get('segmentManager'); });
    }

    public async segment(text: string): Promise<string[] | void> {
        const defaultProvider = this.providers.find(i => i.$id === this.options.defaultProvider);
        if (defaultProvider && defaultProvider.isReady()) {
            return await defaultProvider.segment(text);
        } else {
            logger('warning: defaultProvider not ready');
        }
    }
}
