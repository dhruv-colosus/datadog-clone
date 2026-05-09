import { NotebookTemplateEditor } from "@/features/notebooks";

type Params = { id: string };

export default async function NotebookTemplatePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <NotebookTemplateEditor templateId={id} />;
}
