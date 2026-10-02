import { redirect } from "next/navigation";

// The app starts at sign-in; signed-in users are sent on to the dashboard.
export default function Home() {
  redirect("/sign-in");
}
