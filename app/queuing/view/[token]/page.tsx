import type { Metadata } from "next";
import PublicQueueDisplay from "../../components/PublicQueueDisplay";
export const metadata: Metadata = { title: "Live queue | Badmintoner", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicQueueDisplay token={token} />;
}
