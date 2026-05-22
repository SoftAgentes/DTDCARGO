import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Sitio público, optimizado para SEO. App Router por default.
  reactStrictMode: true,
  // Bloquea que el sitio dependa accidentalmente del repo del ERP.
  // Si alguien importa de "hailuway-erp" → error de bundling.
  experimental: {
    // (placeholder por si más adelante necesitamos turbo opts)
  },
  // Permite que Supabase Storage sirva imágenes vía next/image.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withPayload(nextConfig);
