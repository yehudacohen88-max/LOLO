import "server-only";
import QRCode from "qrcode";
import { voucherQrPayload } from "@/lib/vouchers/code";

export async function voucherQrSvg(code: string, qrSecret: string) {
  const svg = await QRCode.toString(voucherQrPayload(code, qrSecret), {
    type: "svg",
    margin: 1,
    width: 280,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1528", light: "#ffffff" },
  });
  const start = svg.indexOf("<svg");
  return start >= 0 ? svg.slice(start) : svg;
}
