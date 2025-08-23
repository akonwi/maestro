import { ReactNode } from "preact/compat";

export interface HideProps {
  when: boolean;
  children: ReactNode | (() => ReactNode);
}

export function Hide({ when: condition, children }: HideProps) {
  if (condition) return null;

  return typeof children === "function" ? children() : children;
}
