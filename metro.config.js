const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Local Expo module (native code only autolinks; Metro needs an explicit
// pointer to resolve the JS side by its package name).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'receipt-scanner': path.resolve(__dirname, 'modules/receipt-scanner'),
};
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, 'modules')];

module.exports = config;
