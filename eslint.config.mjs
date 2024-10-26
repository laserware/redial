import { fileURLToPath } from "node:url";

import { getBaseConfigs } from "@laserware/eslint-config/base";

const thisDirPath = fileURLToPath(new URL(".", import.meta.url));

const baseConfigs = getBaseConfigs({
  tsConfigRootDir: thisDirPath,
  tsConfigFiles: ["./tsconfig.json", "./tsconfig.node.json"],
});

export default [
  ...baseConfigs,
  {
    ignores: ["eslint.config.mjs"],
  },
];
