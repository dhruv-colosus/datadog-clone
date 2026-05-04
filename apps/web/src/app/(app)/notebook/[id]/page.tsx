import { NotebookEditor } from "@/features/notebooks";

type Params = { id: string };

export default async function NotebookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <NotebookEditor notebookId={id} />;
}
