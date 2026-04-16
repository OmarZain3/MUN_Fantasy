import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { MarketPage } from "./pages/MarketPage";
import { TeamBuilderPage } from "./pages/TeamBuilderPage";
import { MyTeamPage } from "./pages/MyTeamPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LiveHubPage } from "./pages/LiveHubPage";
import { LiveMatchPage } from "./pages/LiveMatchPage";
import { AdminPage } from "./pages/AdminPage";
import { CoordinatorPage } from "./pages/CoordinatorPage";

function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/market" replace />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/builder" element={<TeamBuilderPage />} />
          <Route path="/my-team" element={<MyTeamPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/live" element={<LiveHubPage />} />
          <Route path="/live/:matchId" element={<LiveMatchPage />} />
          <Route path="/coordinator" element={<CoordinatorPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
