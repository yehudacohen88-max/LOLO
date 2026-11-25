import { whatsappInviteMessage } from "@/lib/invite/whatsapp";

export const INVITATION_GREETING_LIMIT = 500;

export function buildInvitationMessage(input: {
  greeting: string;
  guestName: string;
  eventTitle: string;
  inviteUrl: string;
}) {
  const custom = input.greeting.trim().slice(0, INVITATION_GREETING_LIMIT);
  if (!custom) {
    return whatsappInviteMessage(input);
  }
  const name = input.guestName.trim() || "אורח";
  const title = input.eventTitle.trim() || "האירוע";
  const text = custom.replaceAll("{name}", name).replaceAll("{event}", title);
  if (!input.inviteUrl || text.includes(input.inviteUrl)) {
    return text;
  }
  return `${text}\n\n${input.inviteUrl}`;
}
