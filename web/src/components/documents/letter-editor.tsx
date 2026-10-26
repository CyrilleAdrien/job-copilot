"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  fetchLetter,
  paragraphsToText,
  saveLetter,
  textToParagraphs,
  type DocumentInfo,
  type LetterContent,
} from "@/lib/documents";

/** Relecture de la lettre avant envoi : objet et corps, le PDF est refait à l'enregistrement. */
export function LetterEditor({
  document,
  onSaved,
  onCancel,
}: {
  document: DocumentInfo;
  onSaved: (document: DocumentInfo) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState<LetterContent | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLetter(document.id)
      .then((letter) => {
        setContent(letter);
        setSubject(letter.subject);
        setBody(paragraphsToText(letter.paragraphs));
      })
      .catch((e: ApiError) => setError(e.message));
  }, [document.id]);

  async function save() {
    if (!content) return;
    const paragraphs = textToParagraphs(body);
    if (paragraphs.length === 0) {
      setError("La lettre doit contenir au moins un paragraphe.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveLetter(document.id, { ...content, subject, paragraphs }));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  if (!content) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Objet" value={subject} onChange={(event) => setSubject(event.target.value)} />
      <Textarea
        label="Corps de la lettre"
        hint="Une ligne vide sépare deux paragraphes."
        rows={14}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        error={error ?? undefined}
      />
      <div className="flex items-center gap-2">
        <Button onClick={save} loading={saving}>
          Enregistrer et refaire le PDF
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
