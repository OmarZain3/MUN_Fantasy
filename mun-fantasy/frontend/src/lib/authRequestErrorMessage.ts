import axios from "axios";

export function authRequestErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback;
  const data = err.response?.data;
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (!err.response && err.message === "Network Error") {
    return "Cannot reach the API. On Vercel set VITE_API_URL to your Render URL and redeploy; on Render set CLIENT_ORIGIN to this site’s URL.";
  }
  return fallback;
}
