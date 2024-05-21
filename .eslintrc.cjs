"use strict";

module.exports = {
  extends: ["@laserware/eslint-config"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json", "./tsconfig.node.json"],
  },
  ignorePatterns: ["*.js"]
};
