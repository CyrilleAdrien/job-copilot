import { ComingSoon } from "@/components/coming-soon";
import { mainNav } from "@/lib/navigation";

export default function HomePage() {
  return <ComingSoon item={mainNav[0]} />;
}
