import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Reaproveita o ambiente por worker; sem isso o jsdom é recriado ~20x e os testes de
    // rede estouram o timeout de 5 s no Windows (a suíte passava isolada, falhava em conjunto).
    pool: "vmThreads",
    // O ambiente jsdom no Windows pode levar >5 s para montar quando a suíte inteira roda;
    // os testes de rede em si são rápidos. Evita falso vermelho na CI/local.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
