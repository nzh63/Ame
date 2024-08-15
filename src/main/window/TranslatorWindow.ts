import type { Context } from '@main/Context';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import { Menu } from 'electron';
import logger from '@logger/translatorWindow';

export class TranslatorWindow extends WindowWithGeneral {
    private static readonly windowOption = {
        show: false,
        useContentSize: true,
        width: 800,
        height: 300,
        minWidth: 350,
        minheight: 50,
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
        ? 'http://localhost:9090/TranslatorWindow.html'
        // eslint-disable-next-line n/no-path-concat
        : `file://${__dirname}/../render/TranslatorWindow.html`;

    private contextMenu = Menu.buildFromTemplate([{
        id: 'ttsSpeak',
        label: '大声朗读',
        click: () => {
            this.webContents.send('tts-speak-reply');
        }
    }]);

    constructor(
        context: Context,
        public gamePids: number[],
        autoShow = true
    ) {
        super(context, TranslatorWindow.windowOption);
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

    public showContextMenu(x?: number, y?: number) {
        const option: Electron.PopupOptions = {};
        if (x !== undefined) option.x = Math.round(x);
        if (y !== undefined) option.y = Math.round(y);
        this.contextMenu.popup(option);
    }
}
