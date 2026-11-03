/**
 * Le texte enrichi des CV : **gras**, *italique*, __souligné__, listes en « - » et « 1. ».
 * Mêmes règles que services/documents (rich.py et cv.typ). Il passe ici de ce format au document
 * de l'éditeur, et inversement.
 */

export type RichMode = "text" | "list" | "line";

type Mark = { type: "bold" | "italic" | "underline" };
export type RichNode = {
  type: string;
  text?: string;
  marks?: Mark[];
  content?: RichNode[];
  attrs?: Record<string, unknown>;
};

const ESCAPABLE = "*_\\-.0123456789";
const STYLES = ["bold", "italic", "underline"] as const;
type Style = (typeof STYLES)[number];
const NUMBERED = /^\d+\. /;

function tokens(value: string): [Style | "text", string][] {
  const result: [Style | "text", string][] = [];
  const opened = { italic: false, underline: false };
  let index = 0;
  const isMark = (kind: "italic" | "underline", size: number) =>
    opened[kind]
      ? index > 0 && !/\s/.test(value[index - 1])
      : index + size < value.length && !/\s/.test(value[index + size]);

  while (index < value.length) {
    const char = value[index];
    const pair = value.slice(index, index + 2);
    if (char === "\\" && index + 1 < value.length && ESCAPABLE.includes(value[index + 1])) {
      result.push(["text", value[index + 1]]);
      index += 2;
    } else if (pair === "**") {
      result.push(["bold", pair]);
      index += 2;
    } else if (pair === "__" && isMark("underline", 2)) {
      opened.underline = !opened.underline;
      result.push(["underline", pair]);
      index += 2;
    } else if (char === "*" && isMark("italic", 1)) {
      opened.italic = !opened.italic;
      result.push(["italic", char]);
      index += 1;
    } else {
      result.push(["text", char]);
      index += 1;
    }
  }
  return result;
}

export function parseInline(value: string): RichNode[] {
  const parsed = tokens(value);
  const counts = (kind: Style) => parsed.filter(([item]) => item === kind).length;
  const paired = { bold: counts("bold") % 2 === 0, italic: counts("italic") % 2 === 0, underline: counts("underline") % 2 === 0 };
  const state = { bold: false, italic: false, underline: false };
  const nodes: RichNode[] = [];
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const marks = STYLES.filter((style) => state[style]).map((type) => ({ type }));
    nodes.push({ type: "text", text: buffer, ...(marks.length ? { marks } : {}) });
    buffer = "";
  };
  for (const [kind, text] of parsed) {
    if (kind !== "text" && paired[kind]) {
      flush();
      state[kind] = !state[kind];
    } else {
      buffer += text;
    }
  }
  flush();
  return nodes;
}

const paragraph = (line: string): RichNode => {
  const content = parseInline(line);
  return { type: "paragraph", ...(content.length ? { content } : {}) };
};
const list = (type: string, lines: string[]): RichNode => ({
  type,
  content: lines.map((line) => ({ type: "listItem", content: [paragraph(line)] })),
});

/** Le document de l'éditeur pour ce texte. */
export function richToDoc(value: string, mode: RichMode): RichNode {
  if (mode === "line") return { type: "doc", content: [paragraph(value)] };
  const lines = value.split("\n");
  if (mode === "list") return { type: "doc", content: [list("bulletList", lines)] };

  const content: RichNode[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const kind = line.startsWith("- ") ? "bulletList" : NUMBERED.test(line) ? "orderedList" : null;
    if (!kind) {
      content.push(paragraph(line));
      continue;
    }
    const text = kind === "bulletList" ? line.slice(2) : line.replace(NUMBERED, "");
    const last = content[content.length - 1];
    if (last?.type === kind) last.content!.push({ type: "listItem", content: [paragraph(text)] });
    else content.push(list(kind, [text]));
  }
  return { type: "doc", content: content.length ? content : [paragraph("")] };
}

function escapeText(text: string) {
  return text.replace(/[\\*_]/g, (char) => `\\${char}`);
}

function serializeRun(node: RichNode) {
  if (node.type !== "text") return node.type === "hardBreak" ? " " : "";
  const raw = node.text ?? "";
  // Les espaces restent hors des marques : « **mot** », jamais « ** mot ** ».
  const [, before, inner, after] = raw.match(/^(\s*)([\s\S]*?)(\s*)$/) as RegExpMatchArray;
  if (!inner) return raw;
  const marks = new Set(node.marks?.map((mark) => mark.type));
  let text = escapeText(inner);
  if (marks.has("italic")) text = `*${text}*`;
  if (marks.has("underline")) text = `__${text}__`;
  if (marks.has("bold")) text = `**${text}**`;
  return before + text + after;
}

const inlineText = (node: RichNode) => (node.content ?? []).map(serializeRun).join("").trim();

/** Une ligne de texte simple qui ressemble à une liste ne doit pas en devenir une. */
function protectLine(line: string) {
  return line.startsWith("- ") || NUMBERED.test(line) ? `\\${line}` : line;
}

function listLines(node: RichNode): { kind: string; text: string }[] {
  return (node.content ?? []).flatMap((item) =>
    (item.content ?? []).flatMap((child) =>
      child.type === "paragraph" ? [{ kind: node.type, text: inlineText(child) }] : listLines(child),
    ),
  );
}

/** Le texte à enregistrer pour ce document. */
export function docToRich(doc: RichNode, mode: RichMode): string {
  const blocks = doc.content ?? [];
  const lines = blocks.flatMap((block) =>
    block.type === "paragraph" ? [{ kind: "paragraph", text: inlineText(block) }] : listLines(block),
  );
  if (mode === "line") return lines.map((line) => line.text).filter(Boolean).join(" ");
  if (mode === "list") return lines.map((line) => line.text).join("\n");
  let number = 0;
  return lines
    .map((line) => {
      if (line.kind !== "orderedList") number = 0;
      if (line.kind === "bulletList") return `- ${line.text}`;
      if (line.kind === "orderedList") return `${++number}. ${line.text}`;
      return protectLine(line.text);
    })
    .join("\n")
    .trimEnd();
}
