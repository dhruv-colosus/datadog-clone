import { redirect } from "next/navigation";

export default function NotebookIndex() {
  redirect("/notebook/list");
}
