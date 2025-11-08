import { ParentProps } from "solid-js";
import { AuthContext, INITIAL_VALUE } from "./auth";
import { createStore } from "solid-js/store";

export function AuthProvider(props: ParentProps) {
  const [value, setValue] = createStore(INITIAL_VALUE);
  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
}
