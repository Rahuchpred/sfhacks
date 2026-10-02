import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The same dev server opened under three names gives three separate sign-ins, to show
  // three roles side by side: localhost, 127.0.0.1 and gator.localhost.
  allowedDevOrigins: ["127.0.0.1", "gator.localhost"],
};

export default nextConfig;
