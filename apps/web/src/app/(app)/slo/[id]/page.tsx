import { SLODetail } from "@/features/slos";

export default async function SLODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SLODetail id={id} />;
}
