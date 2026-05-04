"use client";

/**
 * Open the browser's print dialog scoped to the notebook content.
 *
 * The page renders the notebook inside #notebook-print-area; @media print rules
 * (see globals.css) hide the app chrome so "Save as PDF" produces a clean
 * document. We temporarily swap document.title so the default PDF filename
 * matches the notebook name.
 */
export function downloadNotebookPdf(name: string): void {
  if (typeof window === "undefined") return;
  const original = document.title;
  document.title = (name || "Notebook").trim();
  // Yield so the title swap takes effect before the print dialog reads it.
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => {
      document.title = original;
    }, 100);
  }, 50);
}
