export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("972")) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length >= 9) {
    return `972${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    return `972${digits}`;
  }
  return digits;
}

export function whatsappInviteMessage(input: {
  guestName: string;
  eventTitle: string;
  inviteUrl: string;
}) {
  const name = input.guestName.trim() || "אורח";
  const title = input.eventTitle.trim() || "האירוע";
  return [
    `היי ${name}`,
    "",
    `אנחנו שמחים להזמין אותך ל${title}`,
    "",
    "לפרטי האירוע ולבחירת מתנה ב-LOLO:",
    input.inviteUrl,
  ].join("\n");
}

export function whatsappInviteUrl(input: {
  phone: string;
  guestName: string;
  eventTitle: string;
  inviteUrl: string;
}) {
  const number = toWhatsAppNumber(input.phone);
  if (!number || !input.inviteUrl) {
    return "";
  }

  const text = whatsappInviteMessage(input);
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`;
}
