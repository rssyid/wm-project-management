import { redirect } from "next/navigation";

// docs/05 §3: Dashboard is the landing page. Login redirect is added in F1.
export default function RootPage() {
  redirect("/dashboard");
}
