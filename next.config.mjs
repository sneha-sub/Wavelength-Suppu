const nextConfig = {
  reactStrictMode: true,
  /* Always .next, which is what Vercel expects. Locally, `npm run build:local`
     sets NEXT_DIST_DIR so a production build doesn't clobber the .next
     directory a running dev server is serving from. */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
