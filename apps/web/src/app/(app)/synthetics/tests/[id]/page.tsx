import { SyntheticTestDetail } from "@/features/synthetics";

export default async function SyntheticTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SyntheticTestDetail id={id} />;
}
