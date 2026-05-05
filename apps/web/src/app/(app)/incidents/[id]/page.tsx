import { IncidentDetail } from "@/features/incidents";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentDetail incidentId={id} />;
}
