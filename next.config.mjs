import withPWA from "@ducanh2912/next-pwa";
const nextConfig = {};
const withPWAConfig = withPWA({
  dest: "public",
});
export default withPWAConfig(nextConfig);