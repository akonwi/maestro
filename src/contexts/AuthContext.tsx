import { createContext, type ComponentChildren } from "preact";
import { useContext, useState, useMemo } from "preact/hooks";

interface AuthContextValue {
  token: string | null;
  isReadOnly: boolean;
  headers: Record<string, string>;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ComponentChildren;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem("maestro_api_token"),
  );

  const isReadOnly = !token;

  const headers = useMemo(() => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      baseHeaders["X-Api-Token"] = token;
    }

    return baseHeaders;
  }, [token]);

  const setToken = (newToken: string) => {
    if (newToken.trim()) {
      localStorage.setItem("maestro_api_token", newToken.trim());
      setTokenState(newToken.trim());
    }
  };

  const clearToken = () => {
    localStorage.removeItem("maestro_api_token");
    setTokenState(null);
  };

  const value: AuthContextValue = {
    token,
    isReadOnly,
    headers,
    setToken,
    clearToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
