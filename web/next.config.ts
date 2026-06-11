import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Resume uploads (PDF/DOCX) go through a Server Action as FormData.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
