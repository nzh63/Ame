import logger from '@logger/translatorWindow';
import type { Session } from '@main/Session';
import { WindowWithSession } from '@main/window/WindowWithSession';
import { Menu } from 'electron';

export class TranslatorWindow extends WindowWithSession {
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
      contextIsolation: false,
    },
  };

  private static readonly url = import.meta.env.DEV
    ? 'http://localhost:9090/TranslatorWindow.html'
    : `file://${__dirname}/../render/TranslatorWindow.html`;

  private contextMenu = Menu.buildFromTemplate([
    {
      id: 'ttsSpeak',
      label: '大声朗读',
      click: () => {
        this.webContents.send('tts-speak-reply');
      },
    },
  ]);

  public constructor(
    session: Session,
    public gamePids: number[],
    autoShow = true,
  ) {
    super(session, TranslatorWindow.windowOption);
    logger('create TranslatorWindow for pids: %O', this.gamePids);
    this.loadURL(TranslatorWindow.url);
    if (autoShow) {
      this.once('ready-to-show', () => {
        this.show();
        this.moveTop();
      });
    }

    this.on('close', (e) => {
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

    this.checkTabletMode();
    this.on('resize', () => this.checkTabletMode());
  }

  public showContextMenu(x?: number, y?: number) {
    const option: Electron.PopupOptions = {};
    if (x !== undefined) option.x = Math.round(x);
    if (y !== undefined) option.y = Math.round(y);
    this.contextMenu.popup(option);
  }

  private checkTabletMode() {
    if (this.isTabletMode()) {
      this.webContents.executeJavaScript("document.documentElement.setAttribute('tablet-mode', 'true')");
    } else {
      this.webContents.executeJavaScript("document.documentElement.setAttribute('tablet-mode', 'false')");
    }
  }
}
