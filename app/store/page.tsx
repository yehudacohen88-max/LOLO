import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeader from "@/components/page-header";
import { getStoreSession } from "@/lib/store/session";
import StoreLoginForm from "./store-login-form";

export const metadata: Metadata = {
  title: "כניסת בית עסק | LOLO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StoreLoginPage() {
  const session = await getStoreSession();
  if (session) {
    redirect("/store/redeem");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:py-16">
      <PageHeader
        title="כניסה למימוש שוברים"
        subtitle="הזינו את שם הכניסה של החנות ואת הקוד שקיבלתם מ-LOLO."
      />
      <StoreLoginForm />
    </main>
  );
}
