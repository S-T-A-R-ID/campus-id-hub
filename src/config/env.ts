const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const normalizeEnv = (value: string | undefined) => value?.trim() || "";

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const supabasePublishableKey = normalizeEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const missingRequiredEnv = [
  ...(supabaseUrl ? [] : ["VITE_SUPABASE_URL"]),
  ...(supabasePublishableKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
];

export const hasRequiredFrontendEnv = missingRequiredEnv.length === 0;
export const missingFrontendEnvKeys = missingRequiredEnv;

export const frontendEnv = {
  supabaseUrl,
  supabasePublishableKey,
  authRedirectBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_AUTH_REDIRECT_BASE_URL || window.location.origin,
  ),
};
