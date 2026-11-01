import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma debe cargarse desde node_modules en runtime (no empaquetado por Turbopack),
  // si no, el motor SQLite no resuelve la ruta de la base de datos (error code 14).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
