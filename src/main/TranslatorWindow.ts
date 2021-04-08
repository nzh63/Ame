import type { General } from '@main/General';
import { BrowserWindow, Menu } from 'electron';
import logger from '@logger/translatorWindow';

export class TranslatorWindow extends BrowserWindow {
    private static readonly windowOption = {
        show: false,
        useContentSize: true,
        width: 800,
        height: 300,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    };

    private static readonly url = import.meta.env.DEV
        ? 'http://localhost:9080/TranslatorWindow.html'
        // eslint-disable-next-line node/no-path-concat
        : `file://${__dirname}/../render/TranslatorWindow.html`;

    private contextMenu = Menu.buildFromTemplate([{
        id: 'ttsSpeak',
        label: '大声朗读',
        click: () => {
            this.webContents.send('tts-speak-reply');
        }
    }]);

    constructor(
        public general: General,
        public gamePids: number[]
    ) {
        super(TranslatorWindow.windowOption);
        logger('create TranslatorWindow for pids: %O', this.gamePids);
        this.loadURL(TranslatorWindow.url);

        this.once('ready-to-show', () => {
            this.show();
            this.moveTop();
        });

        this.on('close', e => {
            this.hide();
            e.preventDefault();
        });
    }

    public showContextMenu() {
        this.contextMenu.popup();
    }
}
