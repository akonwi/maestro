import { ParentProps, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { BetForm, BetFormProps } from "~/components/bet-form";
import { BetFormContext } from "./bet-form.context";

export function BetFormProvider(props: ParentProps) {
  const initialState = { isOpen: false, matchId: null, values: null };
  const [state, setState] = createStore<{
    isOpen: boolean;
    matchId: number | null;
    values: BetFormProps["initialData"] | null;
  }>(initialState);

  return (
    <BetFormContext.Provider
      value={[
        state,
        {
          show: (id, values: BetFormProps["initialData"] | null) =>
            setState({ isOpen: true, matchId: id, values }),
          // for some reason, simply returning `initialState` doesn't change the state.
          close: () => setState({ ...initialState, isOpen: false }),
        },
      ]}
    >
      {props.children}
      <Portal>
        <Show when={state.isOpen && state.matchId != null}>
          <BetForm
            matchId={state.matchId!}
            initialData={state.values ?? undefined}
          />
        </Show>
      </Portal>
    </BetFormContext.Provider>
  );
}
