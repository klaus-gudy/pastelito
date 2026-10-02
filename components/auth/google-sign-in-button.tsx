import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/lib/actions/auth"

export function GoogleSignInButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Button type="submit" variant="outline" size="lg" className="w-full">
        Continue with Google
      </Button>
    </form>
  )
}
