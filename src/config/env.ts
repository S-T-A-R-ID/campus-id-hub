const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const getRequiredEnv = (key: string, value: string | undefined) => {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const frontendEnv = {
  supabaseUrl: getRequiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: getRequiredEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  authRedirectBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_AUTH_REDIRECT_BASE_URL || window.location.origin,
  ),
};
