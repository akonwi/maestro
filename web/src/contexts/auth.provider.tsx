import { createEffect, createSignal, ParentProps } from "solid-js";
import { AuthContext } from "./auth";

const TOKEN_KEY = "maestro_api_token";
const OPENAI_KEY = "maestro_openai_api_key";

// default export for clientOnly usage
export default function AuthProvider(props: ParentProps) {
  const [token, setToken] = createSignal(localStorage.getItem(TOKEN_KEY) ?? "");
  const [openAiKey, setOpenAiKey] = createSignal(
    localStorage.getItem(OPENAI_KEY) ?? "",
  );

  createEffect(() => {
    localStorage.setItem(TOKEN_KEY, token());
  });

  createEffect(() => {
    localStorage.setItem(OPENAI_KEY, openAiKey());
  });

  return (
    <AuthContext.Provider
      value={{
        token,
        setToken,
        openAiKey,
        setOpenAiKey,
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
