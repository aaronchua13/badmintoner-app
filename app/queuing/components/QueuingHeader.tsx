import React, { useRef, useState, useSyncExternalStore } from "react";
import { Button, Dropdown, Modal, Tag, Popover, Segmented, Select } from "antd";
import {
  HomeOutlined,
  DownOutlined,
  PlayCircleOutlined,
  BgColorsOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { formatSessionDuration } from "../utils";
import { ActionResult } from "../state/model";
import styles from "../QueuingClient.module.css";
import type { ColorMode, ColorTheme } from "../hooks/useAppearance";
import { useVisibleTime } from "../hooks/useCurrentTime";
import { subscribe, getSnapshot, getServerSnapshot } from "../state/store";
interface Props {
  appearance: {
    color: ColorTheme;
    mode: ColorMode;
    setAppearance: (value: { color: ColorTheme; mode: ColorMode }) => void;
  };
  playerCount: number;
  courtCount: number;
  queueCount: number;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  sessionStatus: "idle" | "active" | "ended";
  frozenTime: number | null;
  isOffline: boolean;
  disabled: boolean;
  onStartSession: () => Promise<ActionResult>;
  onStopSession: () => Promise<ActionResult>;
  onResetSession: () => Promise<ActionResult>;
  onRestartSession: () => Promise<ActionResult>;
  onOpenPayments: () => void;
  onOpenHistory: () => void;
  onOpenSummary: () => void;
  onPopulateDummy: () => void;
  onOpenInstructions: () => void;
  onExportSession: () => void;
  onImportSession: (text: string) => Promise<ActionResult>;
  onStartTour: () => void;
}
export default function QueuingHeader(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"stop" | "reset" | "restart" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/" aria-label="Back to home" className={styles.home}>
          <HomeOutlined />
        </Link>
        <div>
          <h1>
            Badminton<span>er</span>
          </h1>
          <small>QUEUING · SESSION DESK</small>
        </div>
      </div>
      <div className={styles.sessionStatus}>
        <Tag color={p.sessionStatus === "active" ? "green" : "default"}>
          {p.sessionStatus === "idle"
            ? "Setup"
            : p.sessionStatus === "active"
              ? "Live session"
              : "Session ended"}
        </Tag>
        <div className={styles.sessionClock}>
          <small>SESSION TIME</small>
          <SessionClock sessionStartTime={p.sessionStartTime} sessionEndTime={p.sessionEndTime} frozenTime={p.frozenTime} />
        </div>
      </div>
      <div className={styles.headerActions}>
        <Button disabled={p.disabled} onClick={p.onOpenPayments}>
          Payments
        </Button>
        <Popover
          trigger="click"
          placement="bottomRight"
          title="Appearance"
          content={
            <div className={styles.appearancePanel}>
              <label htmlFor="queue-color-theme">Theme</label>
              <Select
                id="queue-color-theme"
                aria-label="Color theme"
                value={p.appearance.color}
                onChange={(color) =>
                  p.appearance.setAppearance({ color, mode: p.appearance.mode })
                }
                options={[
                  { value: "emerald", label: "Emerald" },
                  { value: "ocean", label: "Ocean" },
                  { value: "violet", label: "Violet" },
                ]}
              />
              <span>Display mode</span>
              <Segmented
                aria-label="Display mode"
                value={p.appearance.mode}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                onChange={(mode) =>
                  p.appearance.setAppearance({
                    color: p.appearance.color,
                    mode: mode as ColorMode,
                  })
                }
              />
              <small>
                Saved on this device. System follows your device settings.
              </small>
            </div>
          }
        >
          <Button
            icon={<BgColorsOutlined aria-hidden="true" />}
            aria-label="Appearance"
          />
        </Popover>
        {p.sessionStatus === "idle" && (
          <Button
            icon={<BarChartOutlined aria-hidden="true" />}
            onClick={p.onOpenSummary}
          >
            Summary
          </Button>
        )}
        {p.sessionStatus === "idle" ? (
          <Button
            type="primary"
            disabled={p.disabled}
            icon={<PlayCircleOutlined aria-hidden="true" />}
            onClick={() => {
              void p.onStartSession();
            }}
          >
            Start Session
          </Button>
        ) : (
          <Button
            type={p.sessionStatus === "ended" ? "primary" : "default"}
            onClick={p.onOpenSummary}
          >
            Summary
          </Button>
        )}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "history",
                label: "Match history",
                onClick: p.onOpenHistory,
              },
              {
                key: "export",
                label: "Export session",
                disabled: p.disabled,
                onClick: p.onExportSession,
              },
              {
                key: "import",
                label: "Import session",
                disabled: p.disabled || p.sessionStatus === "active",
                onClick: () => input.current?.click(),
              },
              { type: "divider" },
              {
                key: "stop",
                label: "Stop session",
                disabled: p.disabled || p.sessionStatus !== "active",
                onClick: () => setConfirm("stop"),
              },
              {
                key: "restart",
                label: "New session · keep players & courts",
                disabled: p.disabled || p.sessionStatus === "idle",
                onClick: () => setConfirm("restart"),
              },
              {
                key: "reset",
                label: "Reset session",
                danger: true,
                disabled: p.disabled,
                onClick: () => setConfirm("reset"),
              },
              { type: "divider" },
              {
                key: "tour",
                label: "Quick walkthrough",
                onClick: p.onStartTour,
              },
              {
                key: "help",
                label: "Instructions",
                onClick: p.onOpenInstructions,
              },
              {
                key: "sample",
                label: "Add sample players",
                disabled: p.disabled || p.sessionStatus === "ended",
                onClick: p.onPopulateDummy,
              },
              {
                key: "repair",
                label: "Refresh offline files",
                onClick: () => {
                  window.location.href = "/queuing?sw=refresh";
                },
              },
            ],
          }}
        >
          <Button aria-label="Session menu">
            Session <DownOutlined aria-hidden="true" />
          </Button>
        </Dropdown>
      </div>
      <div className={styles.connection}>
        <span className={styles.headerCounts}>
          {p.playerCount} players · {p.courtCount} courts · {p.queueCount}{" "}
          queued matches
        </span>
        <span>{p.isOffline ? "○ Offline · work locally" : "● Online"}</span>
        <StorageStatus />
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) await p.onImportSession(await file.text());
        }}
      />
      {confirm !== null && (
        <Modal
          title={
            confirm === "stop"
              ? "End this session?"
              : confirm === "restart"
                ? "Prepare a new session?"
                : "Reset this session?"
          }
          open={confirm !== null}
          onCancel={() => setConfirm(null)}
          confirmLoading={busy}
          okText={
            confirm === "stop"
              ? "Stop session"
              : confirm === "restart"
                ? "New session"
                : "Reset session"
          }
          okButtonProps={{ danger: confirm !== "restart" }}
          onOk={async () => {
            setBusy(true);
            const result = await (confirm === "stop"
              ? p.onStopSession()
              : confirm === "restart"
                ? p.onRestartSession()
                : p.onResetSession());
            setBusy(false);
            if (result.ok) setConfirm(null);
          }}
        >
          <p>
            {confirm === "stop"
              ? "Finish or stop every running match first. Your results will remain available in the summary."
              : confirm === "restart"
                ? "Clear scores, history, player logs, assignments, check-ins, expenses, and all payments while keeping your players and courts. Export the current session first if you need a copy."
                : "Clear this session’s players, courts, queue, history, player logs, expenses, and all payments. Your reusable player database will be kept. Export first if you need a copy."}
          </p>
        </Modal>
      )}
    </header>
  );
}

function SessionClock(p: Pick<Props, "sessionStartTime" | "sessionEndTime" | "frozenTime">) {
  const { ref, currentTime } = useVisibleTime(p.frozenTime, p.sessionStartTime !== null);
  const duration =
    p.sessionStartTime === null
      ? "Ready to begin"
      : formatSessionDuration(
          Math.max(
            0,
            Math.floor(
              ((p.sessionEndTime ?? currentTime) - p.sessionStartTime) / 1000,
            ),
          ),
        );
  return <span ref={ref} className={styles.timer}>{duration}</span>;
}
function StorageStatus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const text = !snapshot.loaded ? "Loading saved session…" : snapshot.pending ? "Saving…" : snapshot.error ? "Not saved" : "Saved on this device";
  return <span role="status">{text}</span>;
}
