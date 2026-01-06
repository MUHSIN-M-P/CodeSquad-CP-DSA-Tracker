import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    base: "./",
    build: {
        rollupOptions: {
            input: {
                popup: resolve(__dirname, "src/popup/index.html"),
                content: resolve(__dirname, "src/content/content.ts"),
                background: resolve(__dirname, "src/background/background.ts"),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    // Keep content and background scripts at root level
                    if (
                        chunkInfo.name === "content" ||
                        chunkInfo.name === "background"
                    ) {
                        return "[name].js";
                    }
                    return "assets/[name]-[hash].js";
                },
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: (assetInfo) => {
                    // Keep popup.html at root level
                    if (assetInfo.name === "popup.html") {
                        return "[name].[ext]";
                    }
                    return "assets/[name]-[hash].[ext]";
                },
            },
        },
        outDir: "dist",
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    publicDir: "public",
});
