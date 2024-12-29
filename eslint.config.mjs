import { fileURLToPath } from "node:url";

import { filePatterns, getBaseConfigs } from "@laserware/eslint-config/base";

const thisDirPath = fileURLToPath(new URL(".", import.meta.url));

const baseConfigs = getBaseConfigs({
  tsConfigRootDir: thisDirPath,
  tsConfigFiles: ["./tsconfig.json", "./tsconfig.eslint.json"],
});

export default [
  ...baseConfigs,
  {
    files: filePatterns.typescript,
    rules: {
      "import/extensions": "off",
    },
  },
  {
    files: ["example/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["eslint.config.mjs"],
  },
];
