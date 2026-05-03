import { PublicDashboardView } from "@/features/dashboards";

type Params = { id: string };

export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <PublicDashboardView dashboardId={id} />;
}
