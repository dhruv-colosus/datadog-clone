"use client";

import {
  Code,
  ListBullets,
  ListNumbers,
  TextB,
  TextH,
  TextItalic,
  TextStrikethrough,
  TextT,
} from "@phosphor-icons/react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Link } from "@tiptap/extension-link";
import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Fired on Enter (without shift). The parent should insert a new cell after this one. */
  onSplit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function MarkdownCell({
  value,
  onChange,
  onSplit,
  placeholder = "Type / for commands",
  autoFocus,
}: Props) {
  const onSplitRef = useRef(onSplit);
  useEffect(() => {
    onSplitRef.current = onSplit;
  }, [onSplit]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-[#006CC2] underline" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "max-w-none focus:outline-none min-h-[24px] text-[14px] leading-relaxed text-[#202124]",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey && onSplitRef.current) {
          event.preventDefault();
          onSplitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  const initial = useRef(true);
  useEffect(() => {
    if (!editor) return;
    if (initial.current) {
      initial.current = false;
      if (autoFocus) editor.commands.focus("end");
      return;
    }
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value, autoFocus]);

  // Re-focus when autoFocus toggles to true (new cell scenario).
  useEffect(() => {
    if (!editor || !autoFocus) return;
    editor.commands.focus("end");
  }, [autoFocus, editor]);

  if (!editor) {
    return (
      <div className="min-h-[24px] py-1 text-[14px] text-[#9aa0a6]">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="relative">
      <FloatingBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function FloatingBar({ editor }: { editor: Editor }) {
  const hasSelection = !editor.state.selection.empty;
  if (!hasSelection) return null;

  return (
    <div className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-md border border-[#3c4043] bg-[#202124] px-1 py-1 text-white shadow-lg">
      <BarBtn
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="Heading"
      >
        <TextH size={14} weight="bold" />
      </BarBtn>
      <BarBtn
        active={editor.isActive("paragraph") && !editor.isActive("heading")}
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Text"
      >
        <TextT size={14} />
      </BarBtn>
      <BarBtn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullets"
      >
        <ListBullets size={14} />
      </BarBtn>
      <BarBtn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered"
      >
        <ListNumbers size={14} />
      </BarBtn>
      <span className="mx-1 h-4 w-px bg-[#5f6368]" />
      <BarBtn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <TextB size={14} weight="bold" />
      </BarBtn>
      <BarBtn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <TextItalic size={14} />
      </BarBtn>
      <BarBtn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strike"
      >
        <TextStrikethrough size={14} />
      </BarBtn>
      <BarBtn
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Code"
      >
        <Code size={14} />
      </BarBtn>
    </div>
  );
}

function BarBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded text-[#e8eaed] transition-colors ${
        active ? "bg-[#006CC2] text-white" : "hover:bg-[#3c4043]"
      }`}
    >
      {children}
    </button>
  );
}
