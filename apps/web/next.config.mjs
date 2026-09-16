/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
  },
};

export default nextConfig;
