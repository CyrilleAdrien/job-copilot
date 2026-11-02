import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // En bas à gauche, le bouton de développement recouvrirait le lien du profil.
  devIndicators: { position: "bottom-right" },
  // Les routes du service profile se terminent par « / » : on les relaie telles quelles.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Aucune autre page ne peut afficher l'app dans un cadre et y faire cliquer l'utilisateur.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
