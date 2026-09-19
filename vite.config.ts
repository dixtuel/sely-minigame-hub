/// <reference types="vitest" />
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin, type UserConfig } from "vite";

function seoMetaPlugin(): Plugin {
  return {
    name: "sely-seo-meta",
    transformIndexHtml(html) {
      const google = process.env.VITE_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION;
      const bing = process.env.VITE_BING_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION;
      const yandex = process.env.VITE_YANDEX_SITE_VERIFICATION || process.env.YANDEX_SITE_VERIFICATION;
      const adsense = process.env.VITE_ADSENSE_CLIENT_ID || process.env.ADSENSE_CLIENT_ID;

      const tags: Array<{ tag: string; attrs: Record<string, string>; injectTo: "head" }> = [];

      if (google) {
        tags.push({ tag: "meta", attrs: { name: "google-site-verification", content: google }, injectTo: "head" });
      }
      if (bing) {
        tags.push({ tag: "meta", attrs: { name: "msvalidate.01", content: bing }, injectTo: "head" });
      }
      if (yandex) {
        tags.push({ tag: "meta", attrs: { name: "yandex-verification", content: yandex }, injectTo: "head" });
      }
      if (adsense) {
        const clientFormatted = adsense.startsWith("ca-") ? adsense : `ca-${adsense}`;
        tags.push({ tag: "meta", attrs: { name: "google-adsense-account", content: adsense }, injectTo: "head" });
        tags.push({
          tag: "script",
          attrs: {
            async: "true",
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientFormatted}`,
            crossorigin: "anonymous",
          },
          injectTo: "head",
        });
      }

      return { html, tags };
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const plugins = [
    react(),
    tailwindcss(),
    ...(isDev ? [jsxLocPlugin()] : []),
    seoMetaPlugin(),
  ];

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    publicDir: path.resolve(import.meta.dirname, "client", "public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      target: ["es2020", "chrome87", "safari14", "firefox78", "edge88"],
      cssTarget: "chrome80",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("three") || id.includes("@react-three") || id.includes("@babylonjs")) {
                return "vendor-3d";
              }
              if (id.includes("framer-motion")) {
                return "vendor-motion";
              }
              if (id.includes("lucide-react")) {
                return "vendor-icons";
              }
              if (id.includes("@tanstack") || id.includes("@trpc")) {
                return "vendor-query";
              }
              if (id.includes("react") || id.includes("wouter")) {
                return "vendor-framework";
              }
            }
          },
        },
      },
    },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".sely.tr",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
    test: {
      root: path.resolve(import.meta.dirname),
      environment: "node",
      include: [
        "server/**/*.test.ts",
        "server/**/*.spec.ts",
        "client/src/**/*.test.ts",
        "client/src/**/*.spec.ts",
      ],
    },
  } as UserConfig & { test?: unknown };
});
