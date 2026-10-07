import { formatGiftAmount } from "@/lib/guest-draft";

export default function SettlementFigures({
  gross,
  commission,
  payable,
}: {
  gross: number;
  commission: number;
  payable: number;
}) {
  const items = [
    { label: "סכום שמומש", value: formatGiftAmount(gross) },
    { label: "עמלת LOLO", value: formatGiftAmount(commission) },
    { label: "לתשלום לבית העסק", value: formatGiftAmount(payable), emphasize: true },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className={`mt-1 text-lg font-bold ${item.emphasize ? "text-brand" : "text-foreground"}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
