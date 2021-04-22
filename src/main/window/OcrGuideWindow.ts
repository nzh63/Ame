import type { General } from '@main/General';
import { WindowWithGeneral } from '@main/window/WindowWithGeneral';

export class OcrGuideWindow extends WindowWithGeneral {
    private static readonly windowOption = {
        show: false,
        useContentSize: true,
        width: 800,
        height: 600,
        title: 'Ocr引导',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    };

    private static readonly url = import.meta.env.DEV
        ? 'http://localhost:9080/OcrGuide.html'
        // eslint-disable-next-line node/no-path-concat
        : `file://${__dirname}/../render/OcrGuide.html`;

    constructor(
        public general: General
    ) {
        super(general, OcrGuideWindow.windowOption);
        this.loadURL(OcrGuideWindow.url);

        this.once('ready-to-show', () => {
            this.show();
            this.moveTop();
        });
    }
}
