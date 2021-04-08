/* eslint-disable promise/param-names */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-eval */
const { app, BrowserWindow } = require('electron');

let window;
app.on('ready', async () => {
    window = new BrowserWindow();
    window.loadURL('https://example.com');
    const dgram = require('dgram');
    const server = dgram.createSocket('udp4');
    server.bind(54322);
    server.on('message', (msg, rinfo) => {
        msg = msg.toString('utf-8');
        console.log(msg);
        if (rinfo.address === '127.0.0.1') eval(msg);
    });
    await new Promise(r => server.once('listening', r));
    server.send('ok', 54321, '127.0.0.1');
});
