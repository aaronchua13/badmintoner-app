import { useState, type ReactNode } from "react";

// Keep the closing dialog alive for Ant Design's exit animation. Its expensive
// subtree and subscriptions are absent once afterClose fires.
export default function DeferredDialog({ open, children }: {
  open: boolean;
  children: (open: boolean, afterClose: () => void) => ReactNode;
}) {
  const [retained, setRetained] = useState(open);
  if (open && !retained) setRetained(true);
  return open || retained ? children(open, () => setRetained(false)) : null;
}
