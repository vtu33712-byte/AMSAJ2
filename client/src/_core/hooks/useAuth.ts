import { startLogin } from "@/const";
import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("cracking-ams-user") || localStorage.getItem("manus-runtime-user-info");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<AuthUser>;
      if (customEvent.detail) {
        setUser(customEvent.detail);
      } else {
        try {
          const saved = localStorage.getItem("cracking-ams-user") || localStorage.getItem("manus-runtime-user-info");
          setUser(saved ? JSON.parse(saved) : null);
        } catch {
          setUser(null);
        }
      }
    };

    window.addEventListener("cracking-ams-auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener("cracking-ams-auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem("cracking-ams-user");
      localStorage.removeItem("manus-runtime-user-info");
      sessionStorage.removeItem("manus-cookie");
    } catch {}
    setUser(null);
  }, []);

  const login = useCallback(() => {
    startLogin();
    const localUser = {
      id: 1,
      name: "Student",
      email: "student@crackingams.local",
      role: "user",
    };
    setUser(localUser);
  }, []);

  return {
    user,
    loading,
    error: null,
    isAuthenticated: Boolean(user),
    logout,
    login,
    refresh: () => {},
  };
}
