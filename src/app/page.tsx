import { redirect } from "next/navigation";

// D-21: root points at the F0 prototype until real pages exist; removed before F2.
export default function RootPage() {
  redirect("/prototipe");
}
