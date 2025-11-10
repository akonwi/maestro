import { createEffect, createSignal, ParentProps } from "solid-js";
import { AuthContext } from "./auth";

const TOKEN_KEY = "maestro_api_token";

// default export for clientOnly usage
export default function AuthProvider(props: ParentProps) {
  const [token, setToken] = createSignal(localStorage.getItem(TOKEN_KEY) ?? "");

  createEffect(() => {
    localStorage.setItem(TOKEN_KEY, token());
  });

  return (
    <AuthContext.Provider
      value={{
        token,
        setToken,
        isReadOnly: () => token() === "",
        headers: () => ({
          "X-Api-Token": token(),
        }),
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
}
