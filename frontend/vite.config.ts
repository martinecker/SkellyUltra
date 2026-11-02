import { defineConfig } from "vitest/config";

// Builds one ES module, custom_components/skelly_ultra/frontend/skelly-ultra.js,
// which defines the panel and the card. The built file is committed, so a
// HACS install needs no build step.
export default defineConfig({
	build: {
		lib: {
			entry: "src/main.ts",
			formats: ["es"],
			fileName: () => "skelly-ultra.js",
		},
		outDir: "../custom_components/skelly_ultra/frontend",
		emptyOutDir: true,
		target: "es2022",
		minify: true,
		sourcemap: false,
		reportCompressedSize: true,
	},
	test: {
		environment: "happy-dom",
		include: ["test/**/*.test.ts"],
	},
});
