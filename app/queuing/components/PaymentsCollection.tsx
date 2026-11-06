import React, { useRef, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Grid,
  Input,
  Popover,
  Segmented,
  Table,
} from "antd";
import { calculateBilling, money, Receipt } from "../state/billing";
import { ActionResult } from "../state/model";
import { PaymentTag } from "./PaymentTag";
import styles from "./PaymentsPanel.module.css";

type Row = ReturnType<typeof calculateBilling>["rows"][number];

type PayProps = {
  row: Row;
  save: (receipt: Receipt) => Promise<ActionResult>;
  received: (receipt: Receipt, name: string) => void;
  other: () => void;
  preserveScroll: () => void;
};
function QuickPay({ row, save, received, other, preserveScroll }: PayProps) {
  const screens = Grid.useBreakpoint();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<React.ComponentRef<typeof Button>>(null);
  const cashRef = useRef<React.ComponentRef<typeof Button>>(null);
  const saving = useRef(false);
  const receiptId = useRef<string | null>(null);
  const changeOpen = (next: boolean) => {
    if (saving.current) return;
    setOpen(next);
    if (!next)
      requestAnimationFrame(() =>
        triggerRef.current?.focus({ preventScroll: true }),
      );
    if (next) {
      receiptId.current = crypto.randomUUID();
      setError(null);
    }
  };
  const pay = async (method: Receipt["method"]) => {
    if (saving.current || row.balance <= 0) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    preserveScroll();
    const receipt: Receipt = {
      id: receiptId.current ?? crypto.randomUUID(),
      playerId: row.id,
      amount: row.balance,
      method,
      paidAt: Date.now(),
      note: "",
    };
    try {
      const result = await save(receipt);
      if (result.ok) {
        setOpen(false);
        received(receipt, row.name);
      } else setError(result.error);
    } catch {
      setError("Payment could not be saved. Please try again.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const content = (
    <div
      className={styles.quickPay}
      role={screens.sm ? "dialog" : undefined}
      aria-label={`Receive payment from ${row.name}`}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving.current) {
          event.stopPropagation();
          changeOpen(false);
        }
      }}
    >
      <strong className={styles.playerName}>{row.name}</strong>
      <p>
        Remaining balance <strong>{money(row.balance)}</strong>
      </p>
      {error && <Alert type="error" title={error} role="alert" />}
      <div className={styles.paymentMethods}>
        <Button
          ref={cashRef}
          type="primary"
          disabled={busy || row.balance <= 0}
          onClick={() => void pay("cash")}
        >
          Cash
        </Button>
        <Button
          type="primary"
          disabled={busy || row.balance <= 0}
          onClick={() => void pay("digital")}
        >
          Digital
        </Button>
      </div>
      <Button
        block
        disabled={busy}
        onClick={() => {
          setOpen(false);
          other();
        }}
      >
        Other amount
      </Button>
      <span className={styles.quickHint} role="status">
        {busy
          ? "Saving payment…"
          : "Records the remaining balance with the current time."}
      </span>
    </div>
  );
  const trigger = (
    <Button
      ref={triggerRef}
      type="primary"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Pay ${row.name}`}
      onClick={() => changeOpen(!open)}
    >
      Pay
    </Button>
  );
  return screens.sm ? (
    <Popover
      destroyOnHidden
      afterOpenChange={(shown) => {
        if (shown) cashRef.current?.focus({ preventScroll: true });
      }}
      content={content}
      title="Receive payment"
      trigger="click"
      open={open}
      onOpenChange={changeOpen}
      placement="bottomRight"
      autoAdjustOverflow
    >
      {trigger}
    </Popover>
  ) : (
    <>
      {trigger}
      <Drawer
        title="Receive payment"
        placement="bottom"
        size="default"
        styles={{ wrapper: { height: "auto", maxHeight: "85dvh" } }}
        open={open}
        afterOpenChange={(shown) => {
          if (shown) cashRef.current?.focus({ preventScroll: true });
        }}
        onClose={() => changeOpen(false)}
        closable={!busy}
        maskClosable={!busy}
        keyboard={!busy}
      >
        {content}
      </Drawer>
    </>
  );
}

export default function PaymentsCollection({
  rows,
  finalized,
  playerFilter,
  save,
  details,
  other,
  missingBilling,
  received,
  success,
}: {
  rows: Row[];
  finalized: boolean;
  playerFilter?: string;
  save: PayProps["save"];
  details: (id: string) => void;
  other: (id: string) => void;
  missingBilling: () => void;
  received: PayProps["received"];
  success: React.ReactNode;
}) {
  const screens = Grid.useBreakpoint();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(playerFilter ? "All" : "To collect");
  const [focused, setFocused] = useState(!!playerFilter);
  const [minHeight, setMinHeight] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const searchInput = useRef<React.ComponentRef<typeof Input>>(null);
  const visible = rows.filter(
    (row) =>
      (!focused || row.id === playerFilter) &&
      row.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (status === "All" ||
        (status === "To collect"
          ? row.balance > 0
          : row.status === "Fully paid")),
  );
  const missing = rows.filter((row) => !row.arrangement);
  const actions = (row: Row) => (
    <div className={styles.rowActions}>
      {row.balance > 0 && (
        <QuickPay
          row={row}
          save={save}
          preserveScroll={() =>
            setMinHeight(list.current?.getBoundingClientRect().height ?? 0)
          }
          received={(receipt, name) => {
            received(receipt, name);
            requestAnimationFrame(() =>
              searchInput.current?.focus({ preventScroll: true }),
            );
          }}
          other={() => other(row.id)}
        />
      )}
      <Button
        aria-label={`Details for ${row.name}`}
        onClick={() => details(row.id)}
      >
        Details
      </Button>
    </div>
  );
  return (
    <section className={styles.collection} aria-label="Payment collection">
      <div className={styles.collectionToolbar}>
        <Input
          ref={searchInput}
          aria-label="Search payments"
          placeholder="Search players"
          value={search}
          allowClear
          onChange={(e) => {
            setSearch(e.target.value);
            setMinHeight(0);
          }}
        />
        <Segmented
          aria-label="Payment status filter"
          block
          options={["To collect", "All", "Paid"]}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setMinHeight(0);
          }}
        />
        {success}
      </div>
      {missing.length > 0 && (
        <Alert
          type="info"
          title={`${missing.length} ${missing.length === 1 ? "player needs" : "players need"} billing`}
          action={<Button onClick={missingBilling}>Set billing</Button>}
        />
      )}
      {focused && (
        <Button
          onClick={() => {
            setFocused(false);
            setMinHeight(0);
          }}
        >
          Show all players
        </Button>
      )}
      <div ref={list} style={{ minHeight }}>
        {screens.md ? (
          <Table<Row>
            className={styles.paymentTable}
            aria-label="Player payments"
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={visible}
            tableLayout="fixed"
            onRow={(row) =>
              ({
                "data-testid": "payment-player",
                "aria-label": row.name,
              }) as React.HTMLAttributes<HTMLTableRowElement>
            }
            columns={[
              {
                title: "Player",
                render: (_, row) => (
                  <div className={styles.playerName}>{row.name}</div>
                ),
              },
              {
                title: "Status",
                width: 130,
                render: (_, row) => (
                  <PaymentTag row={row} finalized={finalized} />
                ),
              },
              {
                title: "Balance",
                className: styles.money,
                width: 152,
                align: "right",
                render: (_, row) => (
                  <strong>
                    {row.charge === null ? "—" : money(row.balance)}
                  </strong>
                ),
              },
              {
                title: "Actions",
                align: "right",
                width: 184,
                render: (_, row) => actions(row),
              },
            ]}
            locale={{ emptyText: "No players match this view" }}
          />
        ) : visible.length ? (
          visible.map((row) => (
            <div
              key={row.id}
              className={styles.collectionRow}
              data-testid="payment-player"
              aria-label={row.name}
            >
              <div className={styles.playerName}>
                <strong>{row.name}</strong>
                <PaymentTag row={row} finalized={finalized} />
              </div>
              <strong className={styles.money}>
                {row.charge === null ? "—" : money(row.balance)}
              </strong>
              {actions(row)}
            </div>
          ))
        ) : (
          <Empty description="No players match this view" />
        )}
      </div>
    </section>
  );
}
