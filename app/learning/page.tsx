import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LearningView from "@/components/learning/LearningView";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  return <LearningView />;
}
