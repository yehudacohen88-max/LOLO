import type { Metadata } from "next";
import PageHeader from "@/components/page-header";
import HostLoginForm from "./host-login-form";

export const metadata: Metadata = {
  title: "כניסה לניהול האירוע | LOLO",
};

export default function HostLoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16">
        <PageHeader
          title="כניסה לניהול האירוע"
          subtitle="הזינו את קישור האירוע ואת קוד הניהול הפרטי"
        />
        <HostLoginForm />
      </main>
    </div>
  );
}
