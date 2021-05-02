import { app, BrowserWindow, BrowserWindowConstructorOptions, session } from 'electron';

app.whenReady().then(() => {
    session.fromPartition('insecure-remote-content')
        .setPermissionRequestHandler((webContents, permission, callback) => callback(false));
});

export class InsecureRemoteBrowserWindow extends BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions) {
        options ??= {};
        options.show = false;
        options.webPreferences ??= {};
        options.webPreferences.sandbox = true;
        options.webPreferences.enableRemoteModule = false;
        options.webPreferences.autoplayPolicy = 'user-gesture-required';
        options.webPreferences.partition = 'insecure-remote-content';
        super(options);
        this.webContents.on('will-navigate', (e) => e.preventDefault());
        this.webContents.on('will-attach-webview', (e) => e.preventDefault());
        this.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        this.webContents.setAudioMuted(true);
    }
}
