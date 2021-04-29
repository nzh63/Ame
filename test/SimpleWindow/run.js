/* eslint-disable promise/param-names */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-eval */
const { app, BrowserWindow, screen } = require('electron');

let window;
app.on('ready', async () => {
    window = new BrowserWindow();
    window.loadURL('https://example.com');
    const dgram = require('dgram');
    const server = dgram.createSocket('udp4');
    server.bind();
    server.on('message', async (msg, rinfo) => {
        msg = msg.toString('utf-8');
        console.log(msg);
        if (rinfo.address === '127.0.0.1') await eval(msg);
        server.send('ack', parseInt(process.argv[2]), '127.0.0.1');
    });
    await new Promise(r => server.once('listening', r));
    server.send(`ok ${server.address().port}`, parseInt(process.argv[2]), '127.0.0.1');
});
