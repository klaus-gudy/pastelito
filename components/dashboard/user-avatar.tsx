import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export type SidebarUser = {
  name: string | null
  email: string
  image: string | null
}

function initials({ name, email }: SidebarUser) {
  const source = name?.trim() || email
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
}

export function UserAvatar({ user }: { user: SidebarUser }) {
  return (
    <Avatar className="size-8 rounded-lg">
      {user.image && (
        // Google profile photos refuse requests that send a referrer.
        <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className="rounded-lg uppercase">
        {initials(user)}
      </AvatarFallback>
    </Avatar>
  )
}
