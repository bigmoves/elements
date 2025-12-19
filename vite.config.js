import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "lib.js",
      name: "QS",
      formats: ["iife"],
      fileName: () => "elements.min.js",
    },
  },
});
