// Server-only access to environment variables. Never import this from a client component.
export function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing environment variable ${name}. Add it in Vercel > Settings > Environment Variables, then redeploy.`);
  }
  return value.trim();
}
