"use client";
import { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import QueueDisplay from "./QueueDisplay";
import { cloudRequest, CloudRequestError } from "../cloud/sync";
import type { DisplayProjection } from "../state/hub";
export default function PublicQueueDisplay({ token }: { token: string }) {
  const [data, setData] = useState<DisplayProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.hidden) return;
      try { const projection = await cloudRequest<DisplayProjection>(`display/${token}`); if (active) { setData(projection); setStale(false); setError(null); } }
      catch (e) { if (!active) return; if (e instanceof CloudRequestError && e.status === 404) { setData(null); setError(e.message); } else { setStale(true); setError("The display is temporarily unavailable. Reconnecting…"); } }
    };
    void load(); const timer = setInterval(load, 5000);
    document.addEventListener("visibilitychange", load); window.addEventListener("online", load);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("online", load); };
  }, [token]);
  if (data) return <QueueDisplay data={data} stale={stale} />;
  return <main style={{ padding: 32 }}>{error ? <Alert type="warning" title={error} /> : <Spin tip="Loading queue display" />}</main>;
}
