import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    hmr: {
      // Browser hits localhost:3001 → container :3000
      clientPort: 3001,
    },
  },
});
