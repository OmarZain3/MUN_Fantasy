import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  token: string | null;
  email: string | null;
  isAdmin: boolean;
  isCoordinator: boolean;
  setAuth: (token: string, email: string, isAdmin: boolean, isCoordinator: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      isAdmin: false,
      isCoordinator: false,
      setAuth: (token, email, isAdmin, isCoordinator) =>
        set({ token, email, isAdmin, isCoordinator }),
      logout: () =>
        set({ token: null, email: null, isAdmin: false, isCoordinator: false }),
    }),
    { name: "mun-fantasy-auth-v2" },
  ),
);
