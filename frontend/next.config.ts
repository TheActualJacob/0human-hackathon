import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/api/sign/:path*",
        destination: "http://127.0.0.1:8000/api/sign/:path*",
      },
    ];
  },
};

export default nextConfig;
