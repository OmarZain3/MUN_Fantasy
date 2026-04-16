import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { authRequestErrorMessage } from "../lib/authRequestErrorMessage";
import { disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";

type AuthResponse = {
  token: string;
  user: { email: string; isAdmin: boolean; isCoordinator?: boolean };
};

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      disconnectSocket();
      setAuth(data.token, data.user.email, data.user.isAdmin, Boolean(data.user.isCoordinator));
      navigate("/market", { replace: true });
    } catch (err: unknown) {
      setError(authRequestErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40">
        <h1 className="text-2xl font-semibold text-white">Sign in</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">Use your MUN Fantasy League account.</p>

        <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-sm space-y-3 text-left">
          <label className="block text-sm text-slate-200">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-400/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm text-slate-200">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-400/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mx-auto mt-6 max-w-sm text-sm text-slate-300">
          No account?{" "}
          <Link className="font-medium text-emerald-300 hover:underline" to="/signup">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
