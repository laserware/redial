"use strict";

require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  extends: ["@laserware/eslint-config"],
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ["*.js"]
};
