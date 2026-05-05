import { WatchdogStoryDetail } from "@/features/watchdog";

export default async function WatchdogStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WatchdogStoryDetail storyId={id} />;
}
