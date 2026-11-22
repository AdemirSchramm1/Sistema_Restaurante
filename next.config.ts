import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components fica desligado na feature 001 (constituição, VII: simplicidade).
  // Todas as telas são dinâmicas e dependem da sessão.
  serverExternalPackages: ["pg"],
  experimental: {
    // Faz o aviso de atualização do Next.js sugerir só correções de segurança.
    agentUpgrade: "security",
  },
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
