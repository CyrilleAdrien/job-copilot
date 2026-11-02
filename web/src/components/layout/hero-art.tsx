"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { heroScene, type HeroScene } from "@/lib/hero";

const PAPER = { fill: "var(--surface)", stroke: "var(--text)", strokeWidth: 1.25 };
const SAND = { fill: "var(--sand)", stroke: "var(--text)", strokeWidth: 1.25 };
const GOLD = { fill: "var(--accent)", stroke: "var(--text)", strokeWidth: 1.25 };
const INK = { fill: "none", stroke: "var(--text)", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Part = ({ level = "a", children }: { level?: "a" | "b" | "c"; children: ReactNode }) => (
  <g className={level === "a" ? "hero-part" : `hero-part hero-part-${level}`}>{children}</g>
);

const Trail = ({ d }: { d: string }) => <path d={d} className="hero-trail" fill="none" stroke="var(--text)" strokeWidth={1.5} />;

const Lines = ({ x, y, widths, gap = 10 }: { x: number; y: number; widths: number[]; gap?: number }) => (
  <path {...INK} d={widths.map((width, index) => `M${x} ${y + index * gap}h${width}`).join("")} />
);

const SCENES: Record<HeroScene, ReactNode> = {
  // Les résultats qui montent.
  dashboard: (
    <>
      <Trail d="M0 124C40 124 66 106 104 112" />
      <path {...INK} d="M108 138H316" />
      <Part>
        <rect x="120" y="96" width="32" height="42" rx="7" {...SAND} />
      </Part>
      <Part level="b">
        <rect x="164" y="72" width="32" height="66" rx="7" {...PAPER} />
      </Part>
      <Part level="b">
        <rect x="208" y="50" width="32" height="88" rx="7" {...PAPER} />
      </Part>
      <Part level="c">
        <rect x="252" y="24" width="32" height="114" rx="7" {...GOLD} />
        <path {...INK} d="M261 44l5 5 9-10" />
      </Part>
    </>
  ),
  // Une pile d'offres, la première avec son score.
  offers: (
    <>
      <Trail d="M0 120C34 120 60 92 112 92" />
      <rect x="150" y="18" width="150" height="88" rx="14" {...SAND} transform="rotate(6 225 62)" />
      <Part>
        <rect x="134" y="26" width="164" height="92" rx="14" {...PAPER} transform="rotate(-3 216 72)" />
      </Part>
      <Part level="b">
        <rect x="116" y="44" width="176" height="94" rx="14" {...PAPER} />
        <rect x="130" y="58" width="28" height="28" rx="8" {...GOLD} />
        <Lines x={168} y={66} widths={[92, 62]} gap={13} />
        <rect x="130" y="104" width="44" height="20" rx="10" {...SAND} />
        <circle cx="264" cy="108" r="14" fill="none" stroke="var(--border-strong)" strokeWidth={3} />
        <circle cx="264" cy="108" r="14" fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeDasharray="62 88" transform="rotate(-90 264 108)" />
      </Part>
    </>
  ),
  // Les étapes d'une candidature : dossier, envoi, entretien, offre.
  applications: (
    <>
      <Trail d="M0 128C24 126 40 118 66 106C100 90 120 76 150 74C188 72 204 96 232 92C262 88 278 64 302 48" />
      <Part>
        <circle cx="66" cy="106" r="24" {...PAPER} />
        <path {...INK} d="M58 94h11l6 6v18H58zM69 94v6h6M62 106h9M62 112h9" />
      </Part>
      <Part level="b">
        <circle cx="150" cy="74" r="24" {...PAPER} />
        <path {...INK} d="M138 74l25-11-8 24-6-9zM149 78l14-15" />
      </Part>
      <Part level="b">
        <circle cx="232" cy="92" r="24" {...SAND} />
        <path {...INK} d="M221 84h22v19h-22zM221 91h22M227 80v6M237 80v6" />
      </Part>
      <Part level="c">
        <circle cx="302" cy="48" r="28" {...GOLD} />
        <path {...INK} d="M290 48l9 9 16-18" />
      </Part>
    </>
  ),
  // La date de l'entretien.
  calendar: (
    <>
      <Trail d="M0 118C50 122 110 118 150 104" />
      <Part>
        <rect x="132" y="28" width="152" height="108" rx="14" {...PAPER} />
        <path d="M132 58V42a14 14 0 0 1 14-14h124a14 14 0 0 1 14 14v16z" {...SAND} />
        <path {...INK} d="M168 20v16M248 20v16" />
        <g fill="var(--text)">
          {[0, 1, 2, 3, 4].flatMap((column) =>
            [0, 1, 2].map((row) => <circle key={`${column}-${row}`} cx={156 + column * 26} cy={76 + row * 22} r={1.6} />),
          )}
        </g>
      </Part>
      <Part level="b">
        <circle cx="208" cy="98" r="11" {...GOLD} />
      </Part>
      <Part level="c">
        <circle cx="290" cy="112" r="25" {...PAPER} />
        <path {...INK} d="M290 96v16l11 7" />
      </Part>
    </>
  ),
  // La réponse du recruteur.
  inbox: (
    <>
      <Trail d="M0 112C40 106 72 124 118 112" />
      <Part level="c">
        <rect x="150" y="10" width="116" height="92" rx="9" {...PAPER} />
        <Lines x={164} y={32} widths={[60, 86, 72]} />
        <circle cx="244" cy="34" r="11" {...GOLD} />
        <path {...INK} d="M239 34l4 4 6-7" />
      </Part>
      <path d="M122 72l86 46 86-46v58a10 10 0 0 1-10 10H132a10 10 0 0 1-10-10z" {...PAPER} />
      <path {...INK} d="M122 72l34-22M294 72l-34-22M122 138l66-34M294 138l-66-34" />
    </>
  ),
  // Le CV.
  profile: (
    <>
      <Trail d="M0 124C36 126 76 100 128 96" />
      <rect x="150" y="16" width="120" height="124" rx="10" {...SAND} transform="rotate(5 210 78)" />
      <Part level="b">
        <rect x="136" y="14" width="124" height="126" rx="10" {...PAPER} />
        <circle cx="164" cy="44" r="15" {...GOLD} />
        <path {...INK} d="M158 54c1-8 11-8 12 0M164 45a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <Lines x={188} y={38} widths={[56, 40]} gap={12} />
        <Lines x={150} y={74} widths={[96, 84, 96]} />
        <rect x="150" y="110" width="38" height="16" rx="8" {...SAND} />
        <rect x="194" y="110" width="50" height="16" rx="8" {...SAND} />
      </Part>
      <Part level="c">
        <circle cx="280" cy="112" r="22" {...GOLD} />
        <path {...INK} d="M271 112l7 7 12-14" />
      </Part>
    </>
  ),
  // Des réglages branchés les uns aux autres, dans l'ordre.
  settings: (
    <>
      <Trail d="M0 110C36 118 70 74 112 44" />
      <path {...INK} d="M112 44H312M112 78H312M112 112H312" />
      <Part>
        <circle cx="178" cy="44" r="13" {...PAPER} />
      </Part>
      <Part level="b">
        <circle cx="262" cy="78" r="13" {...GOLD} />
      </Part>
      <Part level="c">
        <circle cx="146" cy="112" r="13" {...SAND} />
      </Part>
    </>
  ),
  // La candidature qui part.
  send: (
    <>
      <Trail d="M0 134C40 136 92 124 132 100" />
      <Part level="b">
        <path d="M120 84L306 24L236 128L196 96Z" {...PAPER} />
        <path d="M306 24L196 96L192 128L216 112Z" {...GOLD} />
      </Part>
    </>
  ),
};

/** Illustration propre à chaque page. Décorative : le tracé en pointillés figure le parcours de candidature. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 340 150" className="size-full" aria-hidden strokeLinejoin="round">
      {SCENES[heroScene(usePathname())]}
    </svg>
  );
}
