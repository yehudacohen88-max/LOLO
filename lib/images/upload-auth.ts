import "server-only";
import { createHash } from "node:crypto";
import { readBetaSessionValue } from "@/lib/beta/gate";
import { readHostSessionToken } from "@/lib/host/session";
import { readImageUploadGrant } from "@/lib/images/upload-grant";

function principalDigest(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 22);
}

/**
 * A public upload is refused. The caller needs a live host session, a live
 * beta session, or a short-lived grant minted for the create-event pages.
 */
export async function authorizeImageUpload(input: {
  hostToken?: string;
  betaToken?: string;
  uploadToken?: string;
  now?: number;
}): Promise<{ ok: true; principal: string } | { ok: false }> {
  const host = readHostSessionToken(input.hostToken);
  if (host) {
    return { ok: true, principal: `host:${host.eventId}` };
  }

  const betaSecret = process.env.BETA_ACCESS_SECRET?.trim() ?? "";
  if (betaSecret && input.betaToken) {
    const beta = await readBetaSessionValue(betaSecret, input.betaToken, input.now);
    if (beta) {
      return { ok: true, principal: `beta:${principalDigest(input.betaToken)}` };
    }
  }

  const grant = readImageUploadGrant(input.uploadToken, input.now);
  if (grant) {
    return { ok: true, principal: `grant:${grant.id}` };
  }

  return { ok: false };
}
