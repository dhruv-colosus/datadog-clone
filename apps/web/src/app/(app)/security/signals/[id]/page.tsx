import { SignalDetail } from "@/features/security";

export default async function SecuritySignalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SignalDetail signalId={id} />;
}
