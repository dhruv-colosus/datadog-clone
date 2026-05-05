import { RuleEditor } from "@/features/security";

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RuleEditor ruleId={id} />;
}
