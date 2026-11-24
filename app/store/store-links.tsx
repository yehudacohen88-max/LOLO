import Link from "next/link";

export default function StoreDeskLinks() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
      <Link href="/store/redeem" className="text-sm font-semibold text-brand">
        מימוש
      </Link>
      <Link href="/store/business" className="text-sm font-semibold text-brand">
        פרטי העסק
      </Link>
      <Link href="/store/transactions" className="text-sm font-semibold text-brand">
        היסטוריית מימושים
      </Link>
    </div>
  );
}
