"use client";

import { useSearchParams } from "next/navigation";
import type { SyntheticTest, TestType } from "../types";
import { SyntheticApiTestEditor } from "./SyntheticApiTestEditor";
import { SyntheticBrowserTestEditor } from "./SyntheticBrowserTestEditor";

type Props = {
  mode: "create" | "edit";
  initial?: SyntheticTest;
};

export function SyntheticTestEditor({ mode, initial }: Props) {
  const params = useSearchParams();
  const fromQuery = params?.get("type") as TestType | null;
  const fromTemplate = params?.get("template");

  const testType: TestType = initial?.testType ?? fromQuery ?? "api";

  if (testType === "browser") {
    return (
      <SyntheticBrowserTestEditor
        mode={mode}
        initial={initial}
        templateId={fromTemplate}
      />
    );
  }
  return (
    <SyntheticApiTestEditor
      mode={mode}
      initial={initial}
      templateId={fromTemplate}
    />
  );
}
