require('ts-node/register');
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
const glob = require('glob');

const vite = require('vite');
const rollup = require('rollup');

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

async function gotLicense(url, dest) {
    const pipeline = util.promisify(stream.pipeline);
    await fsPromise.mkdir(path.dirname(dest), { recursive: true });
    return pipeline(
        got.stream(url),
        fs.createWriteStream(dest)
    );
}

async function checkFiles(files) {
    try {
        await Promise.all(files.map(i => fsPromise.stat(path.join(__dirname, '../static/', i))));
        return true;
    } catch (e) {
        return false;
    }
}

async function downloadTextractor(version = '4.16.0') {
    const files = [
        'lib/x86/TextractorCLI.exe',
        'lib/x86/texthook.dll',
        'lib/x64/TextractorCLI.exe',
        'lib/x64/texthook.dll'
    ];
    if (await checkFiles(files)) return;

    const pipeline = util.promisify(stream.pipeline);
    const l = gotLicense('https://github.com/Artikash/Textractor/raw/master/LICENSE', path.join(__dirname, '../static/lib/LICENSE.Textractor.txt'));
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
        files.map(i => i.replace('lib/', 'Textractor/')),
        (entry) => entry.fileName.replace(/^Textractor\//, path.join(__dirname, '../static/lib/'))
    );
    await fsPromise.rmdir(tmp, { recursive: true });
    await l;
}

async function downloadLanguageData(version = '4.16.0') {
    const files = [
        'lang-data/jpn.traineddata'
    ];
    if (await checkFiles(files)) return;

    const pipeline = util.promisify(stream.pipeline);
    const l = gotLicense('https://github.com/tesseract-ocr/tessdata_fast/raw/master/LICENSE', path.join(__dirname, '../static/lang-data/LICENSE.tesseract.txt'));
    for (const file of files) {
        const dstPath = path.join(__dirname, '../static/', file);
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        const url = `https://github.com/tesseract-ocr/tessdata_fast/raw/master/${file.replace('lang-data/', '')}`;
        console.log('downloading', url);
        await pipeline(
            got.stream(url)
                .on('downloadProgress', progress => {
                    process.stderr.write(` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`);
                }),
            fs.createWriteStream(dstPath)
        );
    }
    await l;
}

async function downloadDependencies() {
    await downloadTextractor();
    await downloadLanguageData();
}

async function buildNative(generator = 'Visual Studio 15 2017') {
    const files = [
        'native/bin/JBeijingCli.exe',
        'native/bin/DrEyeCli.exe'
    ];
    if (await checkFiles(files)) return;

    console.log('build native module...');
    const exec = util.promisify(child_process.exec);
    await fsPromise.mkdir(path.join(__dirname, '../native/build'), { recursive: true });
    await exec(`cmake -S ${path.join(__dirname, '../native')} -B ${path.join(__dirname, '../native/build')} -G "${generator}" -A win32`);
    await exec(`cmake --build ${path.join(__dirname, '../native/build')} --config Release --target install`);
    await fsPromise.rmdir(path.join(__dirname, '../native/build'), { recursive: true });
}

async function buildRender(mode = 'production') {
    process.type = 'renderer';
    await vite.build({
        configFile: path.join(__dirname, './vite.render.config.ts'),
        mode
    });
}

async function clear(type) {
    await fsPromise.rmdir(path.join(__dirname, '../dist', type), { recursive: true, force: true });
}

async function build(type, mode = 'production') {
    console.log(`build ${type}...`);
    await clear(type);
    const config = require(`./rollup.${type}.config`).default(mode);
    const bundle = await rollup.rollup(config);
    const { output } = await bundle.generate(config.output);
    for (const chunkOrAsset of output) {
        console.log(' ', chunkOrAsset.fileName, chunkOrAsset.isEntry ? '[entry]' : '');
    }
    await bundle.write(config.output);
    await bundle.close();
}

async function buildMain(mode = 'production') {
    await build('main', mode);
}

async function buildWorkers(mode = 'production') {
    await build('workers', mode);
}

async function buildTest(mode = 'development') {
    await build('test', mode);
}

async function devRender(mode = 'development') {
    process.type = 'renderer';
    const server = await vite.createServer({
        configFile: path.join(__dirname, './vite.render.config.ts'),
        mode
    });
    await server.listen(9080);
}

async function devMainAndWorkers(mode = 'development') {
    process.type = 'main';
    await clear('main');
    const configMain = require('./rollup.main.config').default(mode);
    const configWorkers = require('./rollup.workers.config').default(mode);
    const watcher = rollup.watch([configMain, configWorkers]);
    watcher.on('event', ev => {
        if (ev.code === 'END') {
            electronProcess ? restartElectron() : startElectron();
        } else if (ev.code === 'ERROR') {
            console.error(ev.error);
            process.exit(1);
        }
    });
}

let electronProcess = null;
let manualRestart = false;
function startElectron() {
    let args = [
        '--inspect=5858',
        '--require',
        'source-map-support/register',
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

function buildLicense() {
    const self = require('../package.json');
    const map = new Map();
    const files = glob.sync(path.join(__dirname, '../dist/license.*.json'));
    for (const file of files) {
        const json = require(file);
        for (const dep of json) {
            if (dep.name !== self.name) {
                map.set(dep.name, dep);
            }
        }
    }
    const deps = [...map.values()].sort((a, b) => a.name < b.name ? -1 : 1);
    const out = fs.createWriteStream(path.join(__dirname, '../dist/LICENSE.3rdparty.txt'));
    for (const dep of deps) {
        out.write(`${dep.name}\n${(dep.author || {}).name || ''}${(dep.author || {}).email ? `<${dep.author.email}>` : ''}\n`);
        out.write(dep.licenseText || getLicenseText(dep));
        out.write('\n\n');
    }
    out.close();
    function getLicenseText(dep) {
        const dir = path.join(__dirname, '../node_modules', dep.name);
        const licenseFile = glob.sync(path.join(dir, 'LICENSE*'))[0] || glob.sync(path.join(dir, 'license*'))[0] || glob.sync(path.join(dir, 'License*'))[0];
        return licenseFile ? fs.readFileSync(licenseFile, { encoding: 'utf-8' }) : dep.license;
    }
}

async function buildAll() {
    await buildMain();
    await buildWorkers();
    await buildRender();
    buildLicense();
}

function dev() {
    devMainAndWorkers()
        .then(devRender)
        .catch(err => {
            console.error(err);
        });
}

(async function() {
    if (process.argv[2] === 'download:dep') {
        await downloadDependencies();
    } else if (process.argv[2] === 'build:native') {
        await buildNative(process.env.GENERATOR || undefined);
    } else {
        await downloadDependencies();
        await buildNative(process.env.GENERATOR || undefined);

        if (process.argv[2] === 'build:js') {
            await buildAll();
        } else if (process.argv[2] === 'build:main') {
            await buildMain();
        } else if (process.argv[2] === 'build:workers') {
            await buildWorkers();
        } else if (process.argv[2] === 'build:render') {
            await buildRender();
        } else if (process.argv[2] === 'build:test') {
            buildTest();
            buildWorkers();
        } else if (process.argv[2] === 'dev') {
            dev();
        } else {
            buildAll();
        }
    }
})();
process.once('SIGINT', () => {
    if (electronProcess) electronProcess.kill();
    electronProcess = null;
});
