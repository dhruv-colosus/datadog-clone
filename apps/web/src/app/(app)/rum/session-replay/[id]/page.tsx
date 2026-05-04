import { RumSessionDetailPage } from "@/features/rum";

export default async function RumSessionReplayDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RumSessionDetailPage sessionId={decodeURIComponent(id)} />;
}
