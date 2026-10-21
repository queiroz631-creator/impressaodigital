import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuração isolada do Vitest.
 *
 * Mantida separada do `vite.config.ts` (wrapper do Lovable) para não arrastar
 * plugins de app/SSR. Aqui só é necessário o alias `@` -> `src` e o ambiente
 * `node` (a suíte cobre lógica pura de servidor/worker, sem DOM).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
  },
});
