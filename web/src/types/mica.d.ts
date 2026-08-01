// JSX typings for mica custom elements (vendored in src/vendor/mica.css).
// React 19 supports custom elements natively; this only teaches TypeScript
// the tags and their styling attributes.

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MicaGap = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
type MicaAlign = 'start' | 'center' | 'end' | 'stretch'
type MicaJustify = 'start' | 'center' | 'end' | 'between' | 'stretch'
type MicaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type MicaElement<Extra = Record<never, never>> = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Extra

type StackProps = {
  gap?: MicaGap
  align?: MicaAlign
  justify?: MicaJustify
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'm-vstack': MicaElement<StackProps>
      'm-hstack': MicaElement<StackProps & { wrap?: boolean }>
      'm-zstack': MicaElement
      'm-center': MicaElement
      'm-box': MicaElement
      'm-grid': MicaElement<{ min?: MicaSize; gap?: MicaGap }>
      'm-sidecar': MicaElement<{ side?: 'start' | 'end'; gap?: MicaGap }>
      'm-switcher': MicaElement<{ threshold?: MicaSize; gap?: MicaGap }>
      'm-reel': MicaElement<{ gap?: MicaGap }>
      'm-segmented': MicaElement
      'm-badge': MicaElement<{
        variant?: 'primary' | 'success' | 'warning' | 'danger'
        count?: boolean
      }>
    }
  }
}
