import { useState } from "react";
import { Empty, Pagination, Tag } from "antd";
import { activityKinds, type PlayerLog } from "../state/activity";

export default function PlayerLogs({ entries }: { entries: PlayerLog[] }) {
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(entries.length / 10)));
  const visible = [...entries].reverse().slice((current - 1) * 10, current * 10);
  if (!entries.length)
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No activity recorded for this player yet" />;
  return (
    <div>
      <p style={{ color: "var(--ant-color-text-secondary)", fontSize: 12 }}>
        Recorded automatically for this session · Newest first
      </p>
      <ol aria-label="Player activity log" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 360, overflowY: "auto" }}>
        {visible.map((entry) => (
          <li key={entry.id} data-testid="player-log-entry" style={{ padding: "12px 0", borderBottom: "1px solid var(--ant-color-border-secondary)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Tag>{activityKinds[entry.kind]}</Tag>
              <time dateTime={new Date(entry.at).toISOString()} style={{ fontSize: 12, color: "var(--ant-color-text-secondary)" }}>
                {new Date(entry.at).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </time>
            </div>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.message}</p>
          </li>
        ))}
      </ol>
      {entries.length > 10 && (
        <Pagination aria-label="Player log pages" size="small" simple current={current} pageSize={10} total={entries.length} onChange={setPage} style={{ marginTop: 16 }} />
      )}
    </div>
  );
}
