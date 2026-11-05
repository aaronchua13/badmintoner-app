"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Empty } from "antd";
import type { DisplayProjection } from "../state/hub";
import { formatMatchTime } from "../utils";
export default function QueueDisplay({ data, stale, onExit }: { data: DisplayProjection; stale?: boolean; onExit?: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const names = (players: (string | null)[]) => players.filter(Boolean).join(" & ") || "Waiting for players";
  return (
    <main style={{ padding: "clamp(16px, 3vw, 48px)", maxWidth: 1800, margin: "0 auto" }} aria-label="Read-only queue display">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div><h1>{data.title}</h1><p>{data.status === "active" ? "Live session" : data.status === "ended" ? "Session ended" : "Session setup"} · Read-only · Updated {new Date(data.updatedAt).toLocaleTimeString()}</p></div>
        <div style={{ display: "flex", gap: 8 }}><Button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }}>Full screen</Button>{onExit && <Button onClick={onExit}>Back to organizer</Button>}</div>
      </div>
      {stale && <Alert type="warning" showIcon title="Offline or connection interrupted · showing the last update" style={{ marginBottom: 16 }} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
        {data.courts.map((court, i) => <Card key={i} title={court.name} extra={court.status === "active" ? formatMatchTime(Math.max(0, Math.floor((now - (court.startTime ?? now)) / 1000))) : "Idle"}><p style={{ fontSize: 22 }}>{names(court.team1)}</p><p>vs</p><p style={{ fontSize: 22 }}>{names(court.team2)}</p></Card>)}
      </div>
      <h2>Up next</h2>
      {!data.queue.length ? <Empty description="No upcoming matches" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <ol style={{ paddingLeft: 24 }}>{data.queue.map((match, i) => <li key={i} style={{ padding: 16, fontSize: 20 }}>{names(match.team1)} <span style={{ color: "#64748b" }}>vs</span> {names(match.team2)}</li>)}</ol>}
    </main>
  );
}
