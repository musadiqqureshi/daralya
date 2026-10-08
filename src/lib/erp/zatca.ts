/**
 * ZATCA (Saudi e-invoicing) simplified-invoice QR payload: TLV fields, base64.
 * This covers the QR format only. Full Phase-2 integration (XML signing and
 * clearance/reporting with ZATCA) is a separate project — see README.
 */
export function zatcaQrPayload(f: { seller: string; vatNumber: string; timestamp: string; total: string; vat: string }) {
  const enc = new TextEncoder();
  const parts = [f.seller, f.vatNumber, f.timestamp, f.total, f.vat].map((v, i) => {
    const bytes = enc.encode(v);
    return Uint8Array.from([i + 1, bytes.length, ...bytes]);
  });
  const all = Uint8Array.from(parts.flatMap((p) => [...p]));
  return Buffer.from(all).toString("base64");
}
