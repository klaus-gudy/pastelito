"use client"

import { useEffect } from "react"

import { LogoIntro } from "@/components/logo-intro"
import { SIGN_IN_INTRO_COOKIE } from "@/lib/sign-in-intro"

// The logo intro, shown over the dashboard right after signing in.
export function SignInIntro() {
  useEffect(() => {
    // Once per sign-in, even if the page reloads while it plays.
    document.cookie = `${SIGN_IN_INTRO_COOKIE}=; path=/; max-age=0`
  }, [])

  return <LogoIntro label="Signed in to Pastelito" />
}
