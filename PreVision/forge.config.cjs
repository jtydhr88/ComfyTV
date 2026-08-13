const { MakerZIP } = require('@electron-forge/maker-zip');
const { MakerDMG } = require('@electron-forge/maker-dmg');
const { writeBuildProvenance } = require('./scripts/build-provenance.cjs');

module.exports = {
  packagerConfig: {
    name: 'PreVision',
    executableName: 'PreVision',
    appBundleId: 'com.prevision.director',
    appCategoryType: 'public.app-category.video',
    icon: './assets/PreVisionIcon.icns',
    osxSign: {
      identity: '-',
      identityValidation: false,
      optionsForFile: () => ({
        hardenedRuntime: false,
        timestamp: 'none'
      })
    },
    asar: true,
    prune: false,
    ignore: [
      /^\/node_modules($|\/)/,
      /^\/测试($|\/)/,
      /^\/日志($|\/)/,
      /^\/README\.md$/,
      /^\/CLAUDE\.md$/,
      /^\/out($|\/)/
    ]
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      await writeBuildProvenance(buildPath);
    }
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: 'PreVision',
      format: 'ULFO'
    }, ['darwin'])
  ]
};
