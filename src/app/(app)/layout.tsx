import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-bg dark:text-dark-text transition-colors duration-150 flex flex-col">
      {children}
    </div>
  );
}
