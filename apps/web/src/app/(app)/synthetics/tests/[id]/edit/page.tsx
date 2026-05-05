"use client";

import { use } from "react";
import { SyntheticTestEditor, useSyntheticTest } from "@/features/synthetics";

export default function EditSyntheticTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: test, isLoading } = useSyntheticTest(id);

  if (isLoading || !test) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading…
      </div>
    );
  }
  return <SyntheticTestEditor mode="edit" initial={test} />;
}
