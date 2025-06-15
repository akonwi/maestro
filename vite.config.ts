import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	base: "/maestro/",
	plugins: [preact(), tailwindcss()],
	build: {
		rollupOptions: {
			external: ["dexie"],
		},
	},
});
