interface IconProps {
  name: string
  className?: string
  fill?: boolean
  size?: number
}

/** Material Symbols Outlined icon. */
export default function Icon({ name, className = '', fill = false, size }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  )
}
