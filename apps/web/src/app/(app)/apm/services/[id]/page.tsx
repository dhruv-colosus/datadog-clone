import { ServiceDetailPage } from "@/features/apm";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ApmServiceDetailRoute({ params }: RouteProps) {
  const { id } = await params;
  return <ServiceDetailPage serviceId={id} />;
}
