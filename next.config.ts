import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components fica desligado na feature 001 (constituição, VII: simplicidade).
  // Todas as telas são dinâmicas e dependem da sessão.
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
