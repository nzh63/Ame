const os = require('os');
const fs = require('fs');
const fsPromise = require('fs').promises;
const path = require('path');
const stream = require('stream');
const util = require('util');
// eslint-disable-next-line camelcase
const child_process = require('child_process');
const electron = require('electron');
const yauzl = require('yauzl');
const got = require('got');

const vite = require('vite');

function extract(zipPath, files, dst) {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
            if (err) return reject(err);
            zipFile.readEntry();
            zipFile.on('entry', function(entry) {
                if (entry.fileName.endsWith('/')) {
                    zipFile.readEntry();
                } else {
                    if (files.includes(entry.fileName)) {
                        files.splice(files.findIndex(i => i === entry.fileName), 1);
                        zipFile.openReadStream(entry, function(err, readStream) {
                            if (err) return reject(err);
                            const dstPath = dst(entry);
                            fs.mkdirSync(path.dirname(dstPath), { recursive: true });
                            const out = fs.createWriteStream(dstPath, { flags: 'w+' });
                            readStream.pipe(out);
                            readStream.on('end', function() {
                                out.end();
                                if (files.length) zipFile.readEntry();
                                else { zipFile.close(); resolve(); }
                            });
                        });
                    } else {
                        zipFile.readEntry();
                    }
                }
            });
        });
    });
}

async function downloadTextractor(version = '4.16.0') {
    const files = [
        'x86/TextractorCLI.exe',
        'x86/texthook.dll',
        'x64/TextractorCLI.exe',
        'x64/texthook.dll'
    ];
    try {
        await Promise.all(files.map(i => fsPromise.stat(path.join(__dirname, '../static/lib/', i))));
        return;
    } catch (e) { }

    const pipeline = util.promisify(stream.pipeline);
    const url = `https://github.com/Artikash/Textractor/releases/download/v${version}/Textractor-${version}-Zip-Version-English-Only.zip`;
    const tmp = await fsPromise.mkdtemp(os.tmpdir());
    console.log('downloading', url);
    await pipeline(
        got.stream(url)
            .on('downloadProgress', progress => {
                process.stderr.write(` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`);
            }),
        fs.createWriteStream(path.join(tmp, './Textractor.zip'))
    );
    await extract(
        path.join(tmp, './Textractor.zip'),
        files.map(i => 'Textractor/' + i),
        (entry) => entry.fileName.replace(/^Textractor\//, path.join(__dirname, '../static/lib/'))
    );
    await fsPromise.rmdir(tmp, { recursive: true });
}

async function downloadLanguageData(version = '4.16.0') {
    const files = [
        'jpn.traineddata'
    ];
    try {
        await Promise.all(files.map(i => fsPromise.stat(path.join(__dirname, '../assets/lang-data/', i))));
        return;
    } catch (e) { }

    const pipeline = util.promisify(stream.pipeline);
    for (const file of files) {
        const dstPath = path.join(__dirname, '../assets/lang-data/', file);
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        const url = `https://github.com/tesseract-ocr/tessdata_fast/raw/master/${file}`;
        console.log('downloading', url);
        await pipeline(
            got.stream(url)
                .on('downloadProgress', progress => {
                    process.stderr.write(` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`);
                }),
            fs.createWriteStream(dstPath)
        );
    }
}

async function downloadDependencies() {
    await downloadTextractor();
    await downloadLanguageData();
}

async function buildRender(mode = 'production') {
    process.type = 'renderer';
    await vite.build({
        configFile: path.join(__dirname, './vite.render.config.ts'),
        mode
    });
}

async function buildMain(mode = 'production') {
    process.type = 'main';
    await vite.build({
        configFile: path.join(__dirname, './vite.main.config.ts'),
        mode
    });
}

async function buildTest(mode = 'development') {
    process.type = 'main';
    await vite.build({
        configFile: path.join(__dirname, './vite.test.config.ts'),
        mode
    });
}

async function devRender(mode = 'development') {
    process.type = 'renderer';
    const server = await vite.createServer({
        configFile: path.join(__dirname, './vite.render.config.ts'),
        mode
    });
    await server.listen(9080);
}

async function devMain(mode = 'development') {
    process.type = 'main';
    await buildMain(mode);
    const server = await vite.createServer({
        configFile: path.join(__dirname, './vite.main.config.ts'),
        mode
    });
    server.watcher.on('all', async () => {
        await buildMain(mode);
        restartElectron();
    });
}

let electronProcess = null;
let manualRestart = false;
function startElectron() {
    let args = [
        '--inspect=5858',
        path.join(__dirname, '../dist/main/index.js')
    ];

    args = args.concat(process.argv.slice(3));

    electronProcess = child_process.spawn(electron, args, {
        stdio: 'inherit',
        env: {
            DEBUG_COLORS: 'yes',
            DEBUG_DEPTH: 'Infinity'
        }
    });

    electronProcess.on('close', () => {
        if (!manualRestart) process.exit();
    });
}

function restartElectron() {
    if (electronProcess && electronProcess.kill) {
        manualRestart = true;
        process.kill(electronProcess.pid);
        electronProcess = null;
        startElectron();

        setTimeout(() => { manualRestart = false; }, 1000);
    }
}

async function build() {
    await buildMain();
    await buildRender();
}

function dev() {
    devMain()
        .then(devRender)
        .then(() => {
            startElectron();
        })
        .catch(err => {
            console.error(err);
        });
}

(async function() {
    await downloadDependencies();
    if (process.argv[2] === 'build:js') {
        build();
    } else if (process.argv[2] === 'build:main') {
        buildMain();
    } else if (process.argv[2] === 'build:render') {
        buildRender();
    } else if (process.argv[2] === 'build:test') {
        buildTest();
    } else if (process.argv[2] === 'dev') {
        dev();
    } else {
        build();
    }
})();
process.once('SIGINT', () => {
    if (electronProcess) electronProcess.kill();
    electronProcess = null;
});
