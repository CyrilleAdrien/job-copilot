"use client";

import { AlertCircle, Check, Inbox, Plus, RefreshCw, Settings, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "@/components/mail/account-form";
import { ComposeWindow } from "@/components/mail/compose-window";
import { MailFolders } from "@/components/mail/mail-folders";
import { MessageRow, SentRow } from "@/components/mail/message-row";
import { MessageView, SentView } from "@/components/mail/message-view";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SendSettings } from "@/components/mail/send-settings";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { fetchApplications, type ApplicationSummary } from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import {
  applyMessage,
  countByCategory,
  deleteAccount,
  fetchAccounts,
  fetchMessages,
  fetchSent,
  filterMessages,
  markProblemSeen,
  needsReview,
  syncMail,
  syncSummary,
  unseenBounce,
  updateMessage,
  type Category,
  type MailAccount,
  type MailFolder,
  type MailMessage,
  type MailReply,
} from "@/lib/mail";
import { fadeUp, spring } from "@/lib/motion";

/** Une confirmation s'efface seule. Un problème à traiter reste jusqu'à ce qu'on le ferme. */
const NOTICE_MS = 6000;
type Notice = { text: string; lasting: boolean };

export function InboxScreen() {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [sent, setSent] = useState<MailReply[]>([]);
  const [folder, setFolder] = useState<MailFolder>("inbox");
  // Le mail ouvert : tant qu'il y en a un, il remplace la liste.
  const [opened, setOpened] = useState<{ kind: "message" | "sent"; id: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<Category | "all">("all");
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedMessages, loadedApplications, loadedSent] = await Promise.all([
        fetchAccounts(),
        fetchMessages(),
        fetchApplications(),
        fetchSent(),
      ]);
      setAccounts(loadedAccounts);
      setMessages(loadedMessages);
      setSent(loadedSent);
      setApplications(loadedApplications);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice || notice.lasting) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const byId = useMemo(() => new Map(applications.map((item) => [item.id, item])), [applications]);
  const pending = messages.filter(needsReview).length;
  const inboxFolder = folder === "sent" ? "inbox" : folder;
  const counts = countByCategory(filterMessages(messages, inboxFolder, "all"));
  const visible = filterMessages(messages, inboxFolder, category);
  const openedMessage = opened?.kind === "message" ? messages.find((m) => m.id === opened.id) : undefined;
  const openedSent = opened?.kind === "sent" ? sent.find((m) => m.id === opened.id) : undefined;

  function chooseFolder(next: MailFolder) {
    setFolder(next);
    setCategory("all");
    setOpened(null);
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const report = await syncMail();
      setNotice(report.errors.length ? { text: report.errors.join(" "), lasting: true } : { text: syncSummary(report), lasting: false });
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

  function replied(updated: MailMessage) {
    setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    const reply = updated.replies.at(-1);
    if (reply) announceSent(reply);
    fetchSent().then(setSent).catch(() => undefined);
  }

  function composed(reply: MailReply) {
    setComposing(false);
    setSent((current) => [reply, ...current]);
    announceSent(reply);
  }

  function announceSent(reply: MailReply) {
    setNotice(
      reply.status === "uncertain"
        ? { text: "Envoi incertain : vérifie ton dossier Envoyés avant de renvoyer.", lasting: true }
        : { text: `Mail accepté par le serveur d'envoi, à destination de ${reply.to_address}.`, lasting: false },
    );
  }

  /** Lire un mail non distribué éteint le témoin. Il reste marqué dans la liste. */
  async function acknowledge(replies: MailReply[]) {
    const unseen = replies.filter(unseenBounce);
    if (unseen.length === 0) return;
    const ids = new Set(unseen.map((reply) => reply.id));
    setSent((current) => current.map((reply) => (ids.has(reply.id) ? { ...reply, problem_seen: true } : reply)));
    try {
      await Promise.all(unseen.map((reply) => markProblemSeen(reply.id)));
    } catch (e) {
      setError(e as ApiError);
      load();
    }
  }

  function openMessage(id: string) {
    setOpened({ kind: "message", id });
    acknowledge(sent.filter((reply) => reply.message_id === id));
  }

  function openSent(reply: MailReply) {
    setOpened({ kind: "sent", id: reply.id });
    acknowledge([reply]);
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
            {notice.lasting ? <AlertCircle className="size-4 shrink-0 text-warning" aria-hidden /> : <Check className="size-4 shrink-0 text-success" aria-hidden />}
            <span className="min-w-0 flex-1">{notice.text}</span>
            <button type="button" aria-label="Fermer ce message" className="shrink-0 rounded-full p-1 text-text-tertiary transition-colors hover:text-text" onClick={() => setNotice(null)}>
              <X className="size-3.5" aria-hidden />
            </button>
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
        <motion.div {...fadeUp} transition={spring.smooth} className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <MailFolders
            folder={folder}
            counts={{ inbox: pending, pending }}
            alertSent={sent.some(unseenBounce)}
            category={category}
            categoryCounts={counts}
            accounts={accounts}
            onCompose={() => setComposing(true)}
            onFolder={chooseFolder}
            onCategory={(next) => {
              setCategory(next);
              setOpened(null);
            }}
          />
          <Card className="min-w-0 overflow-hidden">
            {openedMessage ? (
              <MessageView
                key={openedMessage.id}
                message={openedMessage}
                application={openedMessage.application_id ? byId.get(openedMessage.application_id) : undefined}
                applications={applications}
                onBack={() => setOpened(null)}
                onUpdate={(changes) => change(openedMessage.id, changes)}
                onApply={() => apply(openedMessage.id)}
                onReplied={replied}
              />
            ) : openedSent ? (
              <SentView
                key={openedSent.id}
                reply={openedSent}
                original={messages.find((m) => m.id === openedSent.message_id)}
                onBack={() => setOpened(null)}
                onOpenOriginal={() => openedSent.message_id && openMessage(openedSent.message_id)}
              />
            ) : folder === "sent" ? (
              sent.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Inbox} title="Aucun mail envoyé" description="Tes réponses et tes nouveaux messages apparaîtront ici." />
                </div>
              ) : (
                <ul aria-label="Mails envoyés" className="flex flex-col divide-y divide-border">
                  {sent.map((reply) => (
                    <SentRow key={reply.id} reply={reply} onOpen={() => openSent(reply)} />
                  ))}
                </ul>
              )
            ) : visible.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Inbox}
                  title={folder === "pending" ? "Tout est à jour" : folder === "treated" ? "Aucun mail traité" : "Aucun mail pour l'instant"}
                  description={
                    folder === "pending"
                      ? "Aucun mail ne demande ton attention. Les statuts sûrs ont été mis à jour tout seuls."
                      : folder === "treated"
                        ? "Les mails que tu marques comme traités apparaîtront ici."
                        : "Synchronise ta boîte pour lire les réponses à tes candidatures."
                  }
                />
              </div>
            ) : (
              <ul aria-label="Mails" className="flex flex-col divide-y divide-border">
                {visible.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    onOpen={() => openMessage(message.id)}
                    onToggleReviewed={() => change(message.id, { reviewed: !message.reviewed })}
                  />
                ))}
              </ul>
            )}
          </Card>
        </motion.div>
      )}

      <AnimatePresence>
        {composing && connected && <ComposeWindow accounts={accounts} onSent={composed} onClose={() => setComposing(false)} />}
      </AnimatePresence>

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
                      <SendSettings
                        account={account}
                        onChange={(updated) => setAccounts((all) => all?.map((item) => (item.id === updated.id ? updated : item)) ?? all)}
                      />
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
