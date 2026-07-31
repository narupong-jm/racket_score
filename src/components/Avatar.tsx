import { avatarColor } from '../lib/avatarColor'

interface AvatarProps {
  name: string
  size: number
}

export function Avatar({ name, size }: AvatarProps) {
  return (
    <div
      role="img"
      aria-label={name}
      className="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: avatarColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size * 0.4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
