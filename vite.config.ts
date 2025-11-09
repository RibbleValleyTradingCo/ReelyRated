import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { getSecurityHeaders } from "./src/config/security-headers";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    middlewareMode: false,
    configureServer(server) {
      server.middlewares.use((_, res, next) => {
        const headers = getSecurityHeaders();
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        next();
      });
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "lucide-react",
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setupTests.ts",
    css: false,
  },
}));
