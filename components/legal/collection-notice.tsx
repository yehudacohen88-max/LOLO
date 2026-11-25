import Link from "next/link";
import { legalCollectionNotice, type LegalNoticeKind } from "@/lib/legal/notices";

const DEFAULT_CLASS = "text-sm leading-relaxed text-muted";

export default function LegalCollectionNotice({
  enabled,
  kind,
  className = DEFAULT_CLASS,
}: {
  enabled: boolean;
  kind: LegalNoticeKind;
  className?: string;
}) {
  const notice = legalCollectionNotice(kind, enabled);
  if (!notice) {
    return null;
  }

  return (
    <p className={className} data-legal-notice={notice.id}>
      {notice.text}{" "}
      <Link href={notice.href} className="underline">
        {notice.linkLabel}
      </Link>
      {notice.marker ? <span>{` ${notice.marker}`}</span> : null}
    </p>
  );
}
