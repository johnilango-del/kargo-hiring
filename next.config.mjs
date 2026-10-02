/** @type {import('next').NextConfig} */
const nextConfig = {
  // unpdf ships its own serverless build of pdf.js; keep it out of the bundler.
  serverExternalPackages: ['unpdf'],
};

export default nextConfig;
