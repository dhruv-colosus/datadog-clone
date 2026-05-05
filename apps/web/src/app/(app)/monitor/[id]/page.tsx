import { MonitorDetail } from "@/features/monitors";

type Params = { id: string };

export default async function MonitorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <MonitorDetail monitorId={id} />;
}
