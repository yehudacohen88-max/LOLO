import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <header className="flex flex-col items-center text-center">
        <Link href="/" className="text-4xl font-extrabold tracking-[0.28em] text-brand">
          LOLO
        </Link>
        <h1 className="mt-8 text-2xl font-bold leading-tight sm:text-4xl">כניסה למימוש שוברים</h1>
        <p className="mt-3 text-base text-muted">
          הזינו את שם הכניסה של החנות ואת הקוד שקיבלתם מ-LOLO.
        </p>
      </header>
      <StoreLoginForm />
    </main>
  );
}
