import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Raise the warning threshold slightly for this bundle size
    chunkSizeWarningLimit: 800,
  },
});