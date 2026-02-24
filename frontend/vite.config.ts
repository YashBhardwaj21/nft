import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        allowedHosts: true,
        proxy: {
            // Forward /api requests to backend — works seamlessly with ngrok
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    }
});
