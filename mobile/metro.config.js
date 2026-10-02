const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, "../src/lib");

config.watchFolders = [sharedRoot];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@shared/")) {
    const name = moduleName.slice("@shared/".length);
    return {
      filePath: path.join(sharedRoot, `${name}.ts`),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
