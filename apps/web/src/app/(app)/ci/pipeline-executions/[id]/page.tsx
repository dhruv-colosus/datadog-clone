import { PipelineExecutionDetail } from "@/features/ci";

export default async function CiExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PipelineExecutionDetail executionId={id} />;
}
