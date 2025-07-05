/* eslint-disable max-nested-callbacks */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable camelcase */
const os = require('os');
const fs = require('fs');
const fsPromise = require('fs').promises;
const path = require('path');
const stream = require('stream');
const util = require('util');
const child_process = require('child_process');
const electron = require('electron');
const yauzl = require('yauzl');
const { got } = require('got');
const { glob } = require('glob');

const rollup = require('rollup');
const { build: electronBuilder } = require('electron-builder');

require('tsx');

function extract(zipPath, files, dst) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
      if (err) return reject(err);
      zipFile.readEntry();
      zipFile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          zipFile.readEntry();
        } else {
          if (files.includes(entry.fileName)) {
            files.splice(
              files.findIndex((i) => i === entry.fileName),
              1,
            );
            zipFile.openReadStream(entry, async (err, readStream) => {
              if (err) return reject(err);
              const dstPath = dst(entry);
              fs.mkdirSync(path.dirname(dstPath), { recursive: true });
              const out = fs.createWriteStream(dstPath, { flags: 'w+' });
              readStream.pipe(out);
              readStream.on('end', () => {
                out.end();
                if (files.length) zipFile.readEntry();
                else {
                  zipFile.close();
                  resolve();
                }
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
  return pipeline(got.stream(url), fs.createWriteStream(dest));
}

async function checkFiles(files) {
  try {
    await Promise.all(files.map((i) => fsPromise.stat(path.join(__dirname, '../', i))));
    return true;
  } catch (e) {
    return false;
  }
}

async function downloadTextractor(version = '5.2.0') {
  const files = [
    'build/static/textractor/x86/TextractorCLI.exe',
    'build/static/textractor/x86/texthook.dll',
    'build/static/textractor/x64/TextractorCLI.exe',
    'build/static/textractor/x64/texthook.dll',
  ];
  if (await checkFiles(files)) return;

  const pipeline = util.promisify(stream.pipeline);
  const url = `https://github.com/Artikash/Textractor/releases/download/v${version}/Textractor-${version}-Zip-Version-English-Only.zip`;
  const tmp = await fsPromise.mkdtemp(os.tmpdir());
  console.log('downloading', url);
  try {
    const license = gotLicense(
      'https://github.com/Artikash/Textractor/raw/master/LICENSE',
      path.join(__dirname, '../build/static/textractor/LICENSE.Textractor.txt'),
    );
    await pipeline(
      got.stream(url).on('downloadProgress', (progress) => {
        process.stderr.write(
          ` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`,
        );
      }),
      fs.createWriteStream(path.join(tmp, './Textractor.zip')),
    );
    await extract(
      path.join(tmp, './Textractor.zip'),
      files.map((i) => i.replace('build/static/textractor/', 'Textractor/')),
      (entry) => entry.fileName.replace(/^Textractor\//, path.join(__dirname, '../build/static/textractor/')),
    );
    await fsPromise.rm(tmp, { recursive: true });
    await license;
  } catch (e) {
    await fsPromise.rm('build/static/textractor', { recursive: true, force: true });
    throw e;
  }
}

async function downloadLanguageData() {
  const files = ['build/static/lang-data/jpn.traineddata'];
  if (await checkFiles(files)) return;

  const pipeline = util.promisify(stream.pipeline);
  try {
    const license = gotLicense(
      'https://github.com/tesseract-ocr/tessdata_fast/raw/main/LICENSE',
      path.join(__dirname, '../build/static/lang-data/LICENSE.tesseract.txt'),
    );
    for (const file of files) {
      const dstPath = path.join(__dirname, '../', file);
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      const url = `https://github.com/tesseract-ocr/tessdata_fast/raw/main/${path.basename(file)}`;
      console.log('downloading', url);
      await pipeline(
        got.stream(url).on('downloadProgress', (progress) => {
          process.stderr.write(
            ` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`,
          );
        }),
        fs.createWriteStream(dstPath),
      );
    }
    await license;
  } catch (e) {
    await fsPromise.rm('build/static/lang-data', { recursive: true, force: true });
    throw e;
  }
}

async function downloadPPOCR() {
  const files = [
    'build/static/ppocr/PP-OCRv5_mobile_det.fp16.ncnn.param',
    'build/static/ppocr/PP-OCRv5_mobile_det.fp16.ncnn.bin',
    'build/static/ppocr/PP-OCRv5_mobile_rec.fp16.ncnn.param',
    'build/static/ppocr/PP-OCRv5_mobile_rec.fp16.ncnn.bin',
    'build/static/ppocr/PP-OCRv5_server_det.fp32.ncnn.param',
    'build/static/ppocr/PP-OCRv5_server_det.fp32.ncnn.bin',
    'build/static/ppocr/PP-OCRv5_server_rec.fp32.ncnn.param',
    'build/static/ppocr/PP-OCRv5_server_rec.fp32.ncnn.bin',
  ];
  if (await checkFiles(files)) return;

  const pipeline = util.promisify(stream.pipeline);
  try {
    const license = gotLicense(
      'https://github.com/PaddlePaddle/PaddleOCR/raw/refs/tags/v3.1.0/LICENSE',
      path.join(__dirname, '../build/static/ppocr/LICENSE.ppocr.txt'),
    );
    for (const file of files) {
      const dstPath = path.join(__dirname, '../', file);
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      const url = `https://github.com/nzh63/ppocr2ncnn/releases/download/20250705/${path.basename(file)}`;
      console.log('downloading', url);
      await pipeline(
        got.stream(url).on('downloadProgress', (progress) => {
          process.stderr.write(
            ` ${Math.round(progress.percent * 100)}% ${progress.transferred} / ${progress.total} bytes\r`,
          );
        }),
        fs.createWriteStream(dstPath),
      );
    }
    await license;
  } catch (e) {
    await fsPromise.rm('build/static/textractor', { recursive: true, force: true });
    throw e;
  }
}

async function downloadDependencies() {
  await downloadTextractor();
  await downloadLanguageData();
  await downloadPPOCR();
}

async function buildNative(arch = 'x64') {
  const files = [
    `build/native/install/${arch}/bin/ScreenCapturer.node`,
    `build/native/install/${arch}/bin/WindowEventHook.node`,
    `build/native/install/${arch}/bin/WindowsHook.node`,
    `build/native/install/${arch}/bin/Process.node`,
    `build/native/install/${arch}/bin/PP-OCR.node`,
    `build/static/native/bin/JBeijingCli.exe`,
    `build/static/native/bin/DrEyeCli.exe`,
  ];
  if (await checkFiles(files)) return;

  console.log('build native module...');

  function spawn(command, args, options) {
    return new Promise((resolve, reject) => {
      const child = child_process.spawn(command, args, { ...options, stdio: 'inherit' });
      child.once('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`child process exited with code ${code}`));
      });
    });
  }

  async function cmake(options) {
    await fsPromise.mkdir(options.buildDir, { recursive: true });
    await spawn('cmake', [
      '-G',
      'Visual Studio 17 2022',
      '-S',
      options.sourceDir,
      '-B',
      options.buildDir,
      '-A',
      options.arch === 'x64' ? 'x64' : 'Win32',
      `-DCMAKE_INSTALL_PREFIX=${options.installDir}`,
    ]);
    await spawn('cmake', ['--build', options.buildDir, '--config', 'Release', '--parallel']);
    await spawn('cmake', ['--install', options.buildDir]);
  }

  await cmake({
    sourceDir: path.join(__dirname, '../native/addons'),
    buildDir: path.join(__dirname, '../build/native/build/addons', arch),
    installDir: path.join(__dirname, '../build/native/install', arch),
    arch,
  });
  await cmake({
    sourceDir: path.join(__dirname, '../native/cli'),
    buildDir: path.join(__dirname, '../build/native/build/cli'),
    installDir: path.resolve(__dirname, '../build/static/native'),
    arch: 'ia32',
  });
}

async function buildRender(mode = 'production') {
  process.type = 'renderer';
  const vite = await import('vite');
  await vite.build({
    ...(await import('./vite.render.config.mts')).default({ mode }),
    mode,
  });
}

async function clear(type) {
  await fsPromise.rm(path.join(__dirname, '../build', type), { recursive: true, force: true });
}

async function build(type, mode = 'production') {
  console.log(`building ${type} for ${mode}...`);
  await clear(type);
  const config = (await import(`./rollup.${type}.config.mts`)).default(mode);
  const bundle = await rollup.rollup(config);
  const { output } = await bundle.generate(config.output);
  for (const chunkOrAsset of output) {
    console.log(' ', chunkOrAsset.fileName, chunkOrAsset.isEntry ? '[entry]' : '');
  }
  await bundle.write(config.output);
  await bundle.close();
}

async function buildMain(mode = 'production', arch = 'x64') {
  await buildNative(arch);
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
  const vite = await import('vite');
  const server = await vite.createServer({
    configFile: path.join(__dirname, './vite.render.config.mts'),
    mode,
  });
  await server.listen(9090);
  process.once('SIGINT', () => {
    server.close();
  });
}

async function devMainAndWorkers(mode = 'development') {
  process.type = 'main';
  await clear('main');
  const configMain = (await import('./rollup.main.config.mts')).default(mode);
  const configWorkers = (await import('./rollup.workers.config.mts')).default(mode);
  const watcher = rollup.watch([configMain, configWorkers]);
  watcher.on('event', (ev) => {
    if (ev.code === 'END') {
      electronProcess ? restartElectron() : startElectron();
    } else if (ev.code === 'START') {
      killElectron();
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
    path.join(__dirname, '../build/main/index.js'),
  ];

  args = args.concat(process.argv.slice(3));

  electronProcess = child_process.spawn(electron, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      DEBUG: 'ame:*',
      DEBUG_COLORS: 'yes',
      DEBUG_DEPTH: 'Infinity',
    },
  });

  electronProcess.stdout.pipe(process.stdout);
  electronProcess.stderr.pipe(process.stderr);

  electronProcess.on('close', () => {
    if (!manualRestart) process.exit();
  });
}

function restartElectron() {
  if (electronProcess && electronProcess.kill) {
    manualRestart = true;
    electronProcess.kill();
    electronProcess = null;
    startElectron();

    setTimeout(() => {
      manualRestart = false;
    }, 1000);
  }
}

function killElectron() {
  if (electronProcess && electronProcess.kill) {
    manualRestart = true;
    electronProcess.kill();
    electronProcess = null;

    setTimeout(() => {
      manualRestart = false;
    }, 1000);
  }
}

function buildLicense() {
  const self = require('../package.json');
  const map = new Map();
  const files = glob.sync([
    path.posix.join(__dirname, '../build/license.*.json'),
    path.posix.join(__dirname, '../build/native/install', process.env.npm_config_arch, 'license.*.json'),
  ]);
  for (const file of files) {
    const json = require(file);
    for (const dep of json) {
      if (dep.name !== self.name) {
        map.set(dep.name, dep);
      }
    }
  }
  const deps = [...map.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
  const out = fs.createWriteStream(path.join(__dirname, '../build/LICENSE.3rdparty.txt'));
  for (const dep of deps) {
    out.write(dep.name);
    if (dep.homepage) {
      out.write(` (${dep.homepage})`);
    }
    out.write('\n');
    if (dep.author?.name) {
      out.write(dep.author.name);
      if (dep.author?.email) {
        out.write(`<${dep.author.email}>`);
      }
      out.write('\n');
    }
    out.write(dep.licenseText || getLicenseText(dep));
    out.write('\n\n');
  }
  out.close();
  function getLicenseText(dep) {
    const dir = path.join(__dirname, '../node_modules', dep.name);
    const licenseFile =
      glob.sync(path.join(dir, 'LICENSE*'))[0] ||
      glob.sync(path.join(dir, 'license*'))[0] ||
      glob.sync(path.join(dir, 'License*'))[0];
    return licenseFile ? fs.readFileSync(licenseFile, { encoding: 'utf-8' }) : dep.license;
  }
}

async function buildJs(mode = 'production') {
  await buildMain(mode);
  await buildWorkers(mode);
  await buildRender(mode);
  if (mode === 'production') buildLicense();
}

async function buildNsis(cliArgs = {}) {
  await downloadDependencies();
  await buildNative(cliArgs.arch);
  await buildJs('production');
  const args = cliArgs;
  args[cliArgs.arch] = true;
  // args['config'] = path.join(__dirname, '../electron-builder.js');
  delete args.arch;
  delete args.mode;
  await electronBuilder(args);
}

function dev(mode = 'development') {
  downloadDependencies()
    .then(() => buildNative(process.arch))
    .then(() => devMainAndWorkers(mode))
    .then(() => devRender(mode))
    .catch((err) => {
      console.error(err);
    });
}

function clean() {
  return Promise.all(
    ['build'].map((i) => fsPromise.rm(path.join(__dirname, '..', i), { recursive: true, force: true })),
  );
}

(async function () {
  const yargs = require('yargs');
  await yargs
    .command('clean', '清理生成的文件', {}, () => clean())
    .command('download-dependencies', '下载依赖', {}, () => downloadDependencies())
    .command('dev', '以开发模式启动', {}, () => dev())
    .command('build', '构建', (args) => {
      return args
        .option('mode', { choices: ['development', 'production', undefined] })
        .option('arch', { choices: ['x64', 'ia32'], default: process.env.npm_config_arch || 'x64' })
        .middleware(async (args) => {
          process.env.npm_config_arch = args.arch;
        })
        .command('js', '构建js文件', {}, (args) => buildJs(args.mode))
        .command('main', '构建主进程', {}, (args) => buildMain(args.mode, args.arch))
        .command('render', '构建渲染进程', {}, (args) => buildRender(args.mode))
        .command('workers', '构建workers', {}, (args) => buildWorkers(args.mode))
        .command('native', '构建原生模块', {}, (args) => buildNative(args.arch))
        .command('test', '构建测试', {}, async (args) => {
          await downloadDependencies();
          await buildNative(args.arch);
          await Promise.all([buildTest('development'), buildWorkers('development')]);
        })
        .command(['$0', 'all'], '构建全部', {}, (args) => buildNsis(args));
    })
    .parse();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

process.on('SIGINT', () => {
  if (electronProcess) electronProcess.kill();
  electronProcess = null;
});
