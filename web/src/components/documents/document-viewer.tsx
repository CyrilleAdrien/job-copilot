"use client";

import { Download, ExternalLink, PenLine, RotateCcw, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { LetterEditor } from "@/components/documents/letter-editor";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  kindLabels,
  pageUrl,
  pdfUrl,
  type DocumentInfo,
  type DocumentKind,
  type Generation,
} from "@/lib/documents";
import { fadeUp, spring } from "@/lib/motion";

export function DocumentViewer({
  generation,
  onChange,
  onRegenerate,
}: {
  generation: Generation;
  onChange: (generation: Generation) => void;
  onRegenerate: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>("cv");
  const [editing, setEditing] = useState(false);
  const document = generation.documents.find((item) => item.kind === kind) ?? generation.documents[0];
  const warnings = generation.warnings.filter((warning) => warning.kind === document.kind);

  function replace(updated: DocumentInfo) {
    onChange({
      ...generation,
      documents: generation.documents.map((item) => (item.id === updated.id ? updated : item)),
    });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {generation.documents.length > 1 ? (
          <SegmentedControl
            label="Document affiché"
            segments={generation.documents.map((item) => ({
              value: item.kind,
              label: kindLabels[item.kind],
            }))}
            value={document.kind}
            onChange={(value) => {
              setKind(value);
              setEditing(false);
            }}
          />
        ) : (
          <span className="text-sm font-medium">{kindLabels[document.kind]}</span>
        )}
        <div className="flex items-center gap-1">
          {document.kind === "letter" && !editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <PenLine aria-hidden />
              Modifier
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a href={pdfUrl(document)} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              Ouvrir
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={pdfUrl(document)} download>
              <Download aria-hidden />
              PDF
            </a>
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {warnings.length > 0 && (
          <motion.div
            {...fadeUp}
            transition={spring.smooth}
            className="flex gap-3 rounded-[10px] bg-warning-soft p-3 text-[13px]"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-warning">À vérifier avant d&apos;envoyer</span>
              <ul className="flex flex-col gap-1 text-text-secondary">
                {warnings.slice(0, 5).map((warning) => (
                  <li key={`${warning.text}-${warning.reason}`}>
                    « {warning.text} » : {warning.reason}.
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="editor" {...fadeUp} transition={spring.smooth}>
            <LetterEditor document={document} onSaved={replace} onCancel={() => setEditing(false)} />
          </motion.div>
        ) : (
          <motion.div key={`${document.id}-${document.version}`} {...fadeUp} transition={spring.smooth}>
            <Preview document={document} />
          </motion.div>
        )}
      </AnimatePresence>

      <Button variant="ghost" size="sm" className="w-fit" onClick={onRegenerate}>
        <RotateCcw aria-hidden />
        Générer une nouvelle version
      </Button>
    </div>
  );
}

/** Pages rendues en images : un aperçu identique au PDF, quel que soit le navigateur. */
function Preview({ document }: { document: DocumentInfo }) {
  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-[10px] bg-background-subtle p-3">
      {Array.from({ length: document.pages }, (_, index) => (
        <Page key={index} src={pageUrl(document, index + 1)} label={`Page ${index + 1}`} />
      ))}
    </div>
  );
}

export function Page({ src, label }: { src: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-[210/297] w-full overflow-hidden rounded-md bg-white shadow-card ring-1 ring-border">
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <motion.img
        src={src}
        alt={label}
        className="size-full object-contain"
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
