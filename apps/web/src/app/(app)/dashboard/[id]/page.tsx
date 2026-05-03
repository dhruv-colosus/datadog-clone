import { DashboardEditor } from "@/features/dashboards";

type Params = { id: string };

export default async function DashboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <DashboardEditor dashboardId={id} />;
}
