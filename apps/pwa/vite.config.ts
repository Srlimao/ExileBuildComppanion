import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Exile Companion HUD",
        short_name: "ExileHUD",
        description: "Real-time second-screen Path of Exile campaign leveling HUD",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        icons: [
          { src: "/assets/poe1/icons/quest.png", sizes: "64x64", type: "image/png" },
          { src: "/assets/poe1/icons/waypoint.png", sizes: "64x64", type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,png,webp,webmanifest}"],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
