export function brandingUrl(file: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/branding/${file}`;
}
