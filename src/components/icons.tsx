/**
 * Iconos SVG en línea (sin librería). Sustituyen a glifos como ⠿ o ✕, que cada sistema
 * (iOS, Android, Windows) dibuja con un tamaño y grosor distintos. Heredan el color del texto.
 */
import type { ReactNode } from 'react'

type IconProps = { size?: number; className?: string }

function Svg({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Asa para arrastrar (seis puntos). */
export function DragIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {[4, 8, 12].map((y) => (
        <g key={y} fill="currentColor" stroke="none">
          <circle cx="5.5" cy={y} r="1.3" />
          <circle cx="10.5" cy={y} r="1.3" />
        </g>
      ))}
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
    </Svg>
  )
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" />
    </Svg>
  )
}
