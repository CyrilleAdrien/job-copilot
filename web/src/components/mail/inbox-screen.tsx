"use client";

import { AlertCircle, Check, Inbox, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "@/components/mail/account-form";
import { MessageRow } from "@/components/mail/message-row";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { fetchApplications, type ApplicationSummary } from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import {
  applyMessage,
  categories,
  categoryOrder,
  countByCategory,
  deleteAccount,
  fetchAccounts,
  fetchMessages,
  filterMessages,
  needsReview,
  syncMail,
  syncSummary,
  updateMessage,
  type Category,
  type InboxView,
  type MailAccount,
  type MailMessage,
} from "@/lib/mail";
import { fadeUp, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function InboxScreen() {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [view, setView] = useState<InboxView>("pending");
  const [category, setCategory] = useState<Category | "all">("all");
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedMessages, loadedApplications] = await Promise.all([
        fetchAccounts(),
        fetchMessages(),
        fetchApplications(),
      ]);
      setAccounts(loadedAccounts);
      setMessages(loadedMessages);
      setApplications(loadedApplications);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(applications.map((item) => [item.id, item])), [applications]);
  const pending = messages.filter(needsReview).length;
  const scope = view === "pending" ? messages.filter(needsReview) : messages;
  const counts = countByCategory(scope);
  const visible = filterMessages(messages, view, category);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const report = await syncMail();
      setNotice(report.errors.length ? report.errors.join(" ") : syncSummary(report));
      await load();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setSyncing(false);
    }
  }

  async function change(id: string, changes: Parameters<typeof updateMessage>[1]) {
    setMessages((current) => current.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    try {
      const updated = await updateMessage(id, changes);
      setMessages((current) => current.map((m) => (m.id === id ? updated : m)));
    } catch (e) {
      setError(e as ApiError);
      load();
    }
  }

  async function apply(id: string) {
    try {
      const updated = await applyMessage(id);
      setMessages((current) => current.map((m) => (m.id === id ? updated : m)));
      setApplications(await fetchApplications());
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function removeAccount(id: string) {
    try {
      await deleteAccount(id);
      await load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const connected = accounts !== null && accounts.length > 0;

  return (
    <>
      <PageHeader
        title="Boîte de réception"
        description="Les réponses des recruteurs, rattachées à tes candidatures."
        actions={
          connected && (
            <>
              <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                {accounts.some((account) => account.last_error) ? (
                  <AlertCircle className="text-danger" aria-hidden />
                ) : (
                  <Settings aria-hidden />
                )}
                Réglages
              </Button>
              <Button variant="secondary" onClick={sync} loading={syncing}>
                <RefreshCw aria-hidden />
                Synchroniser
              </Button>
            </>
          )
        }
      />
      <AnimatePresence>
        {error && (
          <div className="pb-4">
            <ErrorBanner error={error} />
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.p
            {...fadeUp}
            transition={spring.smooth}
            role="status"
            className="mb-4 flex items-center gap-2 rounded-card border border-border bg-background-subtle px-4 py-3 text-sm text-text-secondary"
          >
            <Check className="size-4 text-success" aria-hidden />
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {accounts === null ? (
        error ? null : (
          <div className="flex flex-col gap-4" aria-busy aria-label="Chargement de la boîte de réception">
            <Skeleton className="h-10 w-72 rounded-full" />
            <Skeleton className="h-[320px] rounded-card" />
          </div>
        )
      ) : !connected ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Connecter une boîte mail</CardTitle>
            <CardDescription>
              Job Copilot lit les réponses à tes candidatures, met à jour leur statut et te signale ce qui demande une action.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <AccountForm onAdded={() => load()} />
          </CardContent>
        </Card>
      ) : (
        <motion.div {...fadeUp} transition={spring.smooth} className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  label="Mails affichés"
                  segments={[
                    { value: "pending", label: `À vérifier${pending ? ` (${pending})` : ""}` },
                    { value: "all", label: "Tous" },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Catégorie">
                <CategoryChip label="Toutes" count={scope.length} selected={category === "all"} onClick={() => setCategory("all")} />
                {categoryOrder
                  .filter((c) => counts[c] > 0 || category === c)
                  .map((c) => (
                    <CategoryChip
                      key={c}
                      label={categories[c].label}
                      count={counts[c]}
                      selected={category === c}
                      onClick={() => setCategory(category === c ? "all" : c)}
                    />
                  ))}
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {visible.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={Inbox}
                    title={view === "pending" ? "Tout est à jour" : "Aucun mail pour l'instant"}
                    description={
                      view === "pending"
                        ? "Aucun mail ne demande ton attention. Les statuts sûrs ont été mis à jour tout seuls."
                        : "Synchronise ta boîte pour lire les réponses à tes candidatures."
                    }
                  />
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {visible.map((message) => (
                      <MessageRow
                        key={message.id}
                        message={message}
                        application={message.application_id ? byId.get(message.application_id) : undefined}
                        applications={applications}
                        onUpdate={(changes) => change(message.id, changes)}
                        onApply={() => apply(message.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>

        </motion.div>
      )}

      <Modal
        open={settingsOpen && connected}
        onClose={() => {
          setSettingsOpen(false);
          setAdding(false);
        }}
        title="Réglages de la boîte de réception"
        description="Boîtes lues toutes les 15 minutes, et à la demande."
      >
        <section className="flex flex-col gap-4">
              <ul className="flex flex-col divide-y divide-border">
                {(accounts ?? []).map((account) => (
                  <li key={account.id} className="flex items-start gap-3 py-3 first:pt-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{account.email}</span>
                      <span className="text-[12px] text-text-tertiary">
                        {account.last_sync_at ? `Lue ${timeAgo(account.last_sync_at, new Date())}` : "Jamais lue"} ·{" "}
                        {account.messages} mail{account.messages > 1 ? "s" : ""}
                      </span>
                      {account.last_error && (
                        <span className="flex items-start gap-1 text-[12px] text-danger">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {account.last_error}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-danger"
                      aria-label={`Déconnecter ${account.email}`}
                      title="Déconnecter"
                      onClick={() => removeAccount(account.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              {adding ? (
                <AccountForm
                  onAdded={() => {
                    setAdding(false);
                    load();
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  Ajouter une boîte
                </Button>
              )}
        </section>
      </Modal>
    </>
  );
}

function CategoryChip({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors duration-150",
        selected
          ? "border-accent-strong bg-accent-soft text-accent-strong"
          : "border-border bg-surface text-text-secondary hover:text-text",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
