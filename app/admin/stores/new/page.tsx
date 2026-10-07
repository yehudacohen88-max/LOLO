import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import StoreForm from "../store-form";

export const metadata: Metadata = {
  title: "הוספת בית עסק | LOLO",
};

export const dynamic = "force-dynamic";

export default async function NewAdminStorePage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8">
      <h1 className="text-2xl font-bold text-foreground sm:text-4xl">הוספת בית עסק</h1>
      <StoreForm />
    </main>
  );
}
