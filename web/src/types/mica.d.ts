// Vendored from https://github.com/akonwi/mica v0.2.2 (types/react.d.ts).
// Refresh by re-copying; the diff is the upgrade review.
// React JSX typings for mica's custom elements.
//
// React 19 supports custom elements natively; this file only teaches
// TypeScript the tags and their styling attributes. It is the typed
// mirror of the attribute selectors in mica.css — when an element or
// attribute changes there, it changes here.
//
// Usage (tsconfig `include` or a triple-slash reference):
//   /// <reference types="@akonwi/mica/types/react" />
// or copy the file alongside a vendored mica.css.

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type Gap = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
type Align = 'start' | 'center' | 'end' | 'stretch'
type Justify = 'start' | 'center' | 'end' | 'between' | 'stretch'
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type MicaElement<Extra = Record<never, never>> = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Extra

type StackProps = {
  gap?: Gap
  align?: Align
  justify?: Justify
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // layout
      'm-vstack': MicaElement<StackProps>
      'm-hstack': MicaElement<StackProps & { wrap?: boolean }>
      'm-zstack': MicaElement
      'm-center': MicaElement
      'm-box': MicaElement
      'm-grid': MicaElement<{ min?: Breakpoint; gap?: Gap }>
      'm-sidecar': MicaElement<{ side?: 'start' | 'end'; gap?: Gap }>
      'm-switcher': MicaElement<{ threshold?: Breakpoint; gap?: Gap }>
      'm-reel': MicaElement<{ gap?: Gap }>
      'm-frame': MicaElement<{
        ratio?: 'square' | '16:9' | '9:16' | '4:3' | '3:2' | '2:1'
      }>
      'm-cover': MicaElement<{
        gap?: Gap
        pad?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
      }>

      // components
      'm-segmented': MicaElement
      'm-tabs': MicaElement
      'm-badge': MicaElement<{
        variant?: 'primary' | 'success' | 'warning' | 'danger'
        count?: boolean
      }>
      'm-field': MicaElement
      'm-error': MicaElement<{ active?: boolean }>
      'm-combobox': MicaElement
    }
  }
}
