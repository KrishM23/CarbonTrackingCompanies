import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local default: 8001 avoids conflicts with other projects on :8000.
// Docker Compose can override with VITE_API_PROXY=http://api:8000
const apiTarget = process.env.VITE_API_PROXY || "http://127.0.0.1:8002";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
