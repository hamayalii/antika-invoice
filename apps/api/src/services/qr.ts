import QRCode from "qrcode";
import { verificationUrl } from "./authenticity";

export function renderVerificationQrSvg(code: string): Promise<string> {
  return QRCode.toString(verificationUrl(code), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    width: 256,
    color: { dark: "#1f2937", light: "#ffffff" },
  });
}
