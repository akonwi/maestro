import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    prerender: { crawlLinks: true },
    preset: "static",
    baseURL: process.env.BASE_PATH,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
