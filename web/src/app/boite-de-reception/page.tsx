import type { Metadata } from "next";

import { InboxScreen } from "@/components/mail/inbox-screen";

export const metadata: Metadata = { title: "Boîte de réception" };

export default function InboxPage() {
  return <InboxScreen />;
}
