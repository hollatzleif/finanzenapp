import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomeShell from "@/components/home/HomeShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  return <HomeShell />;
}

