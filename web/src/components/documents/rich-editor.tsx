"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { List, ListOrdered, Redo2, RemoveFormatting, Undo2 } from "lucide-react";
import { useId, type ReactNode } from "react";

import { docToRich, richToDoc, type RichMode, type RichNode } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/** Un champ qui montre directement le gras, l'italique, le souligné et les listes. */
export function RichEditor({
  label,
  value,
  onChange,
  mode = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `text` : paragraphes et listes. `list` : une puce par ligne. `line` : une seule ligne. */
  mode?: RichMode;
  hint?: string;
}) {
  const labelId = useId();
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        ...(mode === "line" ? { bulletList: false, orderedList: false, listItem: false, listKeymap: false } : {}),
        ...(mode === "list" ? { orderedList: false } : {}),
      }),
    ],
    content: richToDoc(value, mode),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": mode === "line" ? "false" : "true",
        "aria-label": label,
        class: cn(
          "min-h-16 px-3 py-2 text-sm leading-relaxed outline-none",
          "[&_strong]:font-bold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-0.5",
          mode === "line" && "min-h-0",
        ),
      },
    },
    onUpdate: ({ editor: current }) => onChange(docToRich(current.getJSON() as RichNode, mode)),
  });

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-medium">
        {label}
      </span>
      <div className="overflow-hidden rounded-[12px] border border-border-strong bg-surface transition-[border-color,box-shadow] focus-within:border-text focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <div role="toolbar" aria-labelledby={labelId} className="flex flex-wrap items-center gap-0.5 border-b border-border bg-background-subtle px-1 py-1">
          <Tool label="Gras" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <span className="text-[15px] font-bold leading-none">B</span>
          </Tool>
          <Tool label="Italique" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <span className="font-serif text-[15px] italic leading-none">I</span>
          </Tool>
          <Tool label="Souligné" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <span className="text-[15px] leading-none underline underline-offset-2">U</span>
          </Tool>
          {mode === "text" && (
            <>
              <Separator />
              <Tool label="Liste à puces" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <List className="size-4" aria-hidden />
              </Tool>
              <Tool label="Liste numérotée" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="size-4" aria-hidden />
              </Tool>
            </>
          )}
          <Separator />
          <Tool label="Effacer la mise en forme" onClick={() => editor?.chain().focus().unsetAllMarks().run()}>
            <RemoveFormatting className="size-4" aria-hidden />
          </Tool>
          <Tool label="Annuler" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 className="size-4" aria-hidden />
          </Tool>
          <Tool label="Rétablir" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 className="size-4" aria-hidden />
          </Tool>
        </div>
        <EditorContent editor={editor} />
      </div>
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-border" />;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Le champ garde sa sélection : le bouton ne doit pas prendre le focus au clic.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-text text-background" : "text-text-secondary hover:bg-surface-hover hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
