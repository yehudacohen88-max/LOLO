import {
  isValidGuestPhone,
  normalizeGuestName,
  normalizeGuestPhone,
} from "@/lib/host/guest-fields";
import type { Guest } from "@/lib/event-draft";

export type ExcelRowIssue = {
  row: number;
  name: string;
  phone: string;
  reason: string;
};

export type ExcelImportResult = {
  guests: Guest[];
  issues: ExcelRowIssue[];
  duplicateCount: number;
};

const NAME_HEADERS = new Set([
  "שם",
  "שם מלא",
  "name",
  "full name",
  "fullname",
]);

const PHONE_HEADERS = new Set([
  "טלפון",
  "מספר טלפון",
  "נייד",
  "phone",
  "mobile",
  "cell",
  "cellphone",
]);

const TEMPLATE_ROWS = [
  ["שם", "טלפון"],
  ["ישראל ישראלי", "0501234567"],
  ["דנה כהן", "0529876543"],
  ["יוסי לוי", "0541112233"],
];

function cellText(value: unknown) {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isAllowedExcelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

export async function downloadGuestExcelTemplate() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  sheet["!cols"] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "מוזמנים");
  XLSX.writeFile(workbook, "lolo-guests-template.xlsx");
}

export async function parseGuestExcelFile(
  file: File,
  existing: Guest[],
): Promise<ExcelImportResult> {
  if (!isAllowedExcelFile(file)) {
    throw new Error("נא לבחור קובץ Excel בפורמט xlsx או xls.");
  }

  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  let workbook: ReturnType<typeof XLSX.read>;

  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new Error("לא ניתן לקרוא את קובץ ה-Excel. בדקו שהקובץ אינו פגום.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("קובץ ה-Excel ריק.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    },
  );

  if (rows.length === 0) {
    throw new Error("קובץ ה-Excel ריק.");
  }

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => cellText(cell).length > 0),
  );
  if (headerIndex < 0) {
    throw new Error("קובץ ה-Excel ריק.");
  }

  const headers = (rows[headerIndex] ?? []).map((cell) =>
    normalizeHeader(cellText(cell)),
  );
  const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
  const phoneIndex = headers.findIndex((header) => PHONE_HEADERS.has(header));

  if (nameIndex < 0 || phoneIndex < 0) {
    throw new Error("חסרות עמודות חובה. נדרשות עמודות שם וטלפון.");
  }

  const seenPhones = new Set(
    existing.map((guest) => normalizeGuestPhone(guest.phone)).filter(Boolean),
  );
  const guests: Guest[] = [];
  const issues: ExcelRowIssue[] = [];
  let duplicateCount = 0;
  let dataRows = 0;

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const name = normalizeGuestName(cellText(row[nameIndex]));
    const rawPhone = cellText(row[phoneIndex]);
    const phone = normalizeGuestPhone(rawPhone);
    const excelRow = index + 1;

    if (!name && !rawPhone) {
      continue;
    }

    dataRows += 1;

    if (!name && !phone) {
      continue;
    }

    if (!name) {
      issues.push({
        row: excelRow,
        name,
        phone: rawPhone,
        reason: "חסר שם",
      });
      continue;
    }

    if (!rawPhone) {
      issues.push({
        row: excelRow,
        name,
        phone: rawPhone,
        reason: "חסר מספר טלפון",
      });
      continue;
    }

    if (!isValidGuestPhone(phone)) {
      issues.push({
        row: excelRow,
        name,
        phone: rawPhone,
        reason: "מספר טלפון אינו תקין",
      });
      continue;
    }

    if (seenPhones.has(phone)) {
      duplicateCount += 1;
      issues.push({
        row: excelRow,
        name,
        phone,
        reason: "מספר הטלפון כבר קיים ברשימה",
      });
      continue;
    }

    seenPhones.add(phone);
    guests.push({
      id: crypto.randomUUID(),
      name,
      phone,
    });
  }

  if (dataRows === 0 && guests.length === 0) {
    throw new Error("לא נמצאו שורות מוזמנים בקובץ.");
  }

  return { guests, issues, duplicateCount };
}
