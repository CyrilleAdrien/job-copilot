import type { Metadata } from "next";

import { SetupAssistant } from "@/components/setup/setup-assistant";

export const metadata: Metadata = { title: "Configuration" };

export default function SetupPage() {
  return <SetupAssistant />;
}
