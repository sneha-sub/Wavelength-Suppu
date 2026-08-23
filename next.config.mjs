const nextConfig = {
  reactStrictMode: true,
  /* Production builds go to .next-build so that running a build never
     clobbers the .next directory a dev server is serving from. */
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};
export default nextConfig;
