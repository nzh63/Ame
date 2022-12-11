import { BrowserWindow, Menu, Tray, app, dialog, shell } from 'electron';
import { join } from 'path';
import fetch from 'electron-fetch';
import { description, name } from '../../package.json';
import { __assets } from '@main/paths';
import { General } from '@main/General';
import '@main/remote';
import logger from '@logger';

export let mainWindow: BrowserWindow | null, tray: Tray;
const mainWindowURL = import.meta.env.DEV
    ? 'http://localhost:9090/MainWindow.html'
    // eslint-disable-next-line n/no-path-concat
    : `file://${__dirname}/../render/MainWindow.html`;

export function createMainWindow() {
    if (mainWindow) {
        mainWindow.show();
        return;
    }
    /**
   * Initial window options
   */
    mainWindow = new BrowserWindow({
        show: false,
        useContentSize: true,
        width: 1280,
        height: 720,
        minWidth: 620,
        minHeight: 400,
        title: description,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadURL(mainWindowURL);

    mainWindow.once('ready-to-show', () => {
        if (!mainWindow) return;
        mainWindow.setContentSize(1280, 720);
        const [width, height] = mainWindow.getContentSize();
        mainWindow.setContentSize(1280 * 2 - width, 720 * 2 - height);
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function quit() {
    General.getAllInstances().forEach(i => i.destroy());
    app.quit();
}

process.on('SIGINT', quit);

app.on('ready', () => {
    logger('app ready');
    tray = new Tray(join(__assets, '/icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: '打开主界面', click: createMainWindow },
        {
            label: '退出',
            click: quit
        }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', createMainWindow);
    tray.setToolTip(name);
    createMainWindow();
    if (import.meta.env.PROD) {
        setTimeout(() => {
            fetch(`https://update.electronjs.org/nzh63/Ame/${process.platform}-${process.arch}/${app.getVersion()}`)
                .then(res => res.json())
                .then(res => {
                    logger('update: %O', res);
                    if (res.name && res.notes && res.url) {
                        dialog.showMessageBox({
                            type: 'info',
                            title: '发现新版本',
                            message: ('' + res.name).trim(),
                            detail: ('' + res.notes).trim().replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/[\n\r]+/g, '\n'),
                            buttons: ['下载', '取消']
                        }).then(({ response }) => {
                            if (response === 0) {
                                shell.openExternal(res.url);
                            }
                        });
                    }
                })
                .catch(e => logger('%O', e));
        }, 3000);
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('window-all-closed', () => {
    // do nothing
});

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
