/* eslint-disable promise/param-names */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-eval */
const { app, BrowserWindow, screen } = require('electron');
const debug = require('debug');
const logger = debug('ame:test:SimpleWindow:run');

let window;
app.on('ready', async () => {
    logger('app ready');
    window = new BrowserWindow({ minimizable: false, alwaysOnTop: true, backgroundThrottling: false });
    window.loadURL('about:blank');
    const http = require('http');
    const server = http.createServer(async (req, resp) => {
        if (req.socket.remoteAddress === '127.0.0.1') {
            let msg = '';
            req.on('data', data => { msg += '' + data; });
            await new Promise(resolve => req.once('end', resolve));
            logger('recv req: %s', msg);
            try {
                const ret = await eval(msg);
                resp.statusCode = 200;
                resp.write(ret);
            } catch (e) {
                resp.statusCode = 400;
                resp.write('err' + JSON.stringify(e));
            }
            resp.end();
        }
        resp.end();
    });
    logger('create http server...');
    server.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    logger('http server listen on %o', server.address());
    fetch(`http://127.0.0.1:${parseInt(process.argv[2])}`, { method: 'post', body: '' + server.address().port });
});
