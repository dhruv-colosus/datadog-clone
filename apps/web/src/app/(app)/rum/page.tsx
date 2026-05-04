import { redirect } from "next/navigation";

export default function RumIndex() {
  redirect("/rum/summary");
}
