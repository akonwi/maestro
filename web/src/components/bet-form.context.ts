import { createContext } from "solid-js";
import { BetFormProps } from "./bet-form";

type IBetFormContext = [
  { isOpen: boolean },
  {
    show: (
      matchId: number | null,
      values?: BetFormProps["initialData"] | null,
    ) => void;
    close: () => void;
  },
];

export const BetFormContext = createContext<IBetFormContext>([
  { isOpen: false },
  { show: function () {}, close: () => {} },
]);
