import type { General } from '@main/General';
import { WindowWithGeneral } from '@main/window/WindowWithGeneral';
import { Menu } from 'electron';
import logger from '@logger/translatorWindow';

export class TranslatorWindow extends WindowWithGeneral {
    private static readonly windowOption = {
        show: false,
        useContentSize: true,
        width: 800,
        height: 300,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        maximizable: false,
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
        general: General,
        public gamePids: number[],
        autoShow = true
    ) {
        super(general, TranslatorWindow.windowOption);
        logger('create TranslatorWindow for pids: %O', this.gamePids);
        this.loadURL(TranslatorWindow.url);
        if (autoShow) {
            this.once('ready-to-show', () => {
                this.show();
                this.moveTop();
            });
        }

        this.on('close', e => {
            this.hide();
            e.preventDefault();
        });

        this.on('focus', () => {
            logger('windows focus');
            this.webContents.send('window-focus');
        });
        this.on('blur', () => {
            logger('windows blur');
            this.webContents.send('window-blur');
        });
    }

    public showContextMenu() {
        this.contextMenu.popup();
    }
}
