/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  transpilePackages: ["@tracemigo/ui"],
  async redirects() {
    return [
      {
        source: "/practice",
        destination: "/catalog",
        permanent: true,
      },
      {
        source: "/practice/:language/:slug",
        destination: "/cases/:language/:slug",
        permanent: true,
      },
      {
        source: "/practice/:attemptId([0-9a-fA-F-]{36})",
        destination: "/workspace/:attemptId",
        permanent: false,
      },
    ];
  },
};
export default config;

