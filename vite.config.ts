import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // All /api calls go through the local Node server (geocoding +
      // Overpass with a proper User-Agent; future price-API keys stay
      // server-side).
      "/api": "http://localhost:8787",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
