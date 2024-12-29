import { builtinModules } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const rootDirPath = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const [processName] = mode.replace("@", "").split("/");

  const commonOptions = {
    base: "./",
    build: {
      emptyOutDir: false,
      minify: false,
      rollupOptions: {
        external: [
          "electron",
          // And also exclude Node internals from build.
          ...builtinModules.flatMap((name) => [name, `node:${name}`]),
        ],
        output: {
          entryFileNames: "[name].js",
        },
      },
      sourcemap: true,
    },
  };

  if (processName === "main") {
    return {
      ...commonOptions,
      build: {
        ...commonOptions.build,
        outDir: join("dist", "main"),
        lib: {
          entry: join("src", "main.ts"),
          formats: ["cjs"],
        },
      },
    };
  }

  if (processName === "renderer") {
    return {
      ...commonOptions,
      build: {
        ...commonOptions.build,
        outDir: join("dist", "renderer"),
        rollupOptions: {
          ...commonOptions.build.rollupOptions,
          input: {
            renderer: resolve(rootDirPath, "index.html"),
          },
        },
      },
    };
  }

  throw new Error(`Invalid process name ${processName}`);
});
