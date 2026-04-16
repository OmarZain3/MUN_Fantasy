import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";

type AuthResponse = {
  token: string;
  user: { email: string; isAdmin: boolean; isCoordinator?: boolean };
};

export function SignupPage() {
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
      const { data } = await api.post<AuthResponse>("/auth/signup", {
        email,
        password,
      });
      disconnectSocket();
      setAuth(data.token, data.user.email, data.user.isAdmin, Boolean(data.user.isCoordinator));
      navigate("/builder", { replace: true });
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err && "response" in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Signup failed")
          : "Signup failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40">
        <h1 className="text-2xl font-semibold text-white">Sign up</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">Password must be at least 8 characters.</p>

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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="mx-auto mt-6 max-w-sm text-sm text-slate-300">
          Already have an account?{" "}
          <Link className="font-medium text-emerald-300 hover:underline" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
