module.exports = {
  productName: 'Ame',
  appId: 'nzh63.ame',
  directories: {
    output: 'build/nsis',
  },
  files: [
    'build/src/**/*.node',
    'build/main/**/*',
    'build/workers/**/*',
    'build/render/**/*',
    'assets/*',
    '!**/node_modules/**/*',
  ],
  buildDependenciesFromSource: true,
  extraResources: [
    {
      from: 'build/static',
      to: 'static',
      filter: ['**/*', '!static/native/bin/GPS.txt'],
    },
    {
      from: './build',
      to: '..',
      filter: ['LICENSE.*.txt'],
    },
    {
      from: `node_modules/@img/sharp-${process.platform}-${process.env.npm_config_arch}/lib`,
      to: '..',
      filter: ['*.dll'],
    },
  ],
  icon: './assets/icon.png',
  nsis: {
    deleteAppDataOnUninstall: true,
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${platform}-${env.npm_config_arch}-${buildVersion}.${ext}',
  },
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: true,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: true,
  },
};
