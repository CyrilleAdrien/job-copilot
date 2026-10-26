import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Les routes du service profile se terminent par « / » : on les relaie telles quelles.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
