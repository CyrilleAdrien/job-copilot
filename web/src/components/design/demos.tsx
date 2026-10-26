"use client";

import { FileText, RotateCcw, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { JobCardSkeleton } from "@/components/ui/skeleton";
import { StepProgress } from "@/components/ui/step-progress";
import { fadeUp, spring } from "@/lib/motion";

const generationSteps = [
  { id: "read", label: "Lecture de l'offre" },
  { id: "select", label: "Sélection des expériences" },
  { id: "write", label: "Rédaction" },
  { id: "layout", label: "Mise en page" },
];

export function GenerationDemo() {
  const [current, setCurrent] = useState(0);
  const done = current >= generationSteps.length;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setCurrent((step) => step + 1), 1100);
    return () => clearTimeout(timer);
  }, [current, done]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-ai" aria-hidden />
            Génération du CV
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCurrent(0)} disabled={!done}>
            <RotateCcw aria-hidden />
            Rejouer
          </Button>
        </div>
        <StepProgress steps={generationSteps} current={current} />
        <AnimatePresence>
          {done && (
            <motion.div
              {...fadeUp}
              transition={spring.smooth}
              className="flex items-center gap-3 rounded-[10px] border border-border bg-background-subtle p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-ai-soft text-ai-strong">
                <FileText className="size-4" aria-hidden />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">CV_Cyrille_FOTSO_SRE.pdf</span>
                <span className="text-xs text-text-tertiary">Prêt à relire</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export function SkeletonDemo() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setLoading(true)} disabled={loading}>
          <RotateCcw aria-hidden />
          Recharger
        </Button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div key="skeleton" exit={{ opacity: 0 }} className="flex flex-col gap-3">
            <JobCardSkeleton />
            <JobCardSkeleton />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
          >
            <JobRow title="Ingénieur SRE" company="Doctolib" place="Paris" age="il y a 2 h" />
            <JobRow title="DevOps Engineer" company="Qonto" place="Paris" age="il y a 1 j" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRow({
  title,
  company,
  place,
  age,
}: {
  title: string;
  company: string;
  place: string;
  age: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent-soft text-sm font-semibold text-accent-strong">
        {company[0]}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="text-sm text-text-secondary">
          {company} · {place}
        </span>
      </div>
      <span className="text-xs text-text-tertiary">{age}</span>
    </div>
  );
}

type Window = "1" | "3" | "7" | "14" | "30";

export function DateWindowDemo() {
  const [value, setValue] = useState<Window>("7");
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<Window>
        label="Date de publication"
        value={value}
        onChange={setValue}
        segments={[
          { value: "1", label: "24 h" },
          { value: "3", label: "3 j" },
          { value: "7", label: "7 j" },
          { value: "14", label: "14 j" },
          { value: "30", label: "30 j" },
        ]}
      />
      <p className="text-sm text-text-secondary">
        Offres publiées depuis {value === "1" ? "24 heures" : `${value} jours`}, les plus
        récentes en premier.
      </p>
    </div>
  );
}

export function StatsDemo() {
  const stats = [
    { label: "Candidatures", value: 42 },
    { label: "Taux de réponse", value: 31, suffix: " %" },
    { label: "Entretiens", value: 6 },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">{stat.label}</span>
            <span className="text-[28px] font-semibold tracking-tight">
              <AnimatedNumber value={stat.value} suffix={stat.suffix} />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FormDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-4">
      <Input label="Poste recherché" placeholder="Ingénieur SRE" hint="Séparer plusieurs rôles par une virgule." />
      <Input label="Ville" icon={<Search />} placeholder="Paris" />
      <Input label="Rayon (km)" defaultValue="abc" error="Saisis un nombre." />
      <div className="flex items-start pt-[26px]">
        <Button
          variant="accent"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
