import { redirect } from "next/navigation";

export default function CiPipelinesPage() {
  redirect("/ci/pipeline-executions");
}
