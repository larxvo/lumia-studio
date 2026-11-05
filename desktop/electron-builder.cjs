module.exports = {
  appId: 'com.vovinhlac.lumastudio', productName: 'Luma Studio',
  copyright: 'Created by Larx Vo · vovinhlac.com',
  directories: {app: 'desktop/app', output: 'releases/windows', buildResources: 'desktop/resources'},
  files: ['*.cjs', '*.png', 'package.json', '!node_modules/**/*'],
  extraResources: [{from: 'dist', to: 'editor', filter: ['**/*', '!assets/luma-source.part*', '!assets/source-manifest.json']}],
  asar: true, npmRebuild: false,
  win: {target: [{target: 'nsis', arch: ['x64']}], icon: 'desktop/resources/luma.ico',
    executableName: 'Luma Studio', signExecutable: false, artifactName: 'Luma-Studio-${version}-Setup-${arch}.${ext}'},
  fileAssociations: [{ext: 'luma', name: 'Luma Studio project', role: 'Editor'},
    {ext: ['psd', 'psb'], name: 'Photoshop document', role: 'Editor'}],
  nsis: {oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: 'Luma Studio',
    installerIcon: 'desktop/resources/luma.ico', uninstallerIcon: 'desktop/resources/luma.ico',
    license: 'LICENSE', deleteAppDataOnUninstall: false, runAfterFinish: true},
  publish: null
};
