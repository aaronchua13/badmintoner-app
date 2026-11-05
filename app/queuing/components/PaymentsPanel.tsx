import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  Table,
  Row as AntRow,
  Col,
  Grid,
} from "antd";
import { QueueData, ActionResult } from "../state/model";
import {
  Arrangement,
  Expenses,
  Receipt,
  calculateBilling,
  emptyBilling,
  expensesSchema,
  money,
} from "../state/billing";
import type { useQueuingState } from "../hooks/useQueuingState";
import styles from "./PaymentsPanel.module.css";

type Actions = ReturnType<typeof useQueuingState>["actions"];
type Row = ReturnType<typeof calculateBilling>["rows"][number];
const arrangements = [
  { value: "shared", label: "Session payment" },
  { value: "separate", label: "Separate payment" },
  { value: "none", label: "No charge" },
];
export function PaymentTag({
  row,
  finalized,
}: {
  row: Row;
  finalized: boolean;
}) {
  return (
    <Tag
      title={finalized ? "Final assigned charge" : "Based on assigned charge"}
      color={
        row.status === "Fully paid"
          ? "green"
          : row.status === "Partially paid"
            ? "orange"
            : "default"
      }
    >
      {row.status}
    </Tag>
  );
}
function ExpenseForm({
  expenses,
  save,
  excluded,
  players,
  canBill,
  continueBilling,
}: {
  excluded: string[];
  players: Row[];
  expenses: Expenses;
  canBill: boolean;
  save: (v: Expenses, excluded: string[]) => Promise<ActionResult>;
  continueBilling: (suggestion: number | null, excluded: string[]) => void;
}) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const initial = {
    ...expenses,
    excluded,
    courtFee: expenses.courtFee / 100,
    tubePrice: expenses.tubePrice / 100,
  };
  const values = Form.useWatch([], form) ?? initial;
  const centavos = (v: unknown) =>
    typeof v === "number" ? Math.round(v * 100) : NaN;
  const parsed = expensesSchema.safeParse({
    courtFee: centavos(values.courtFee),
    tubePrice: centavos(values.tubePrice),
    piecesPerTube: values.piecesPerTube,
    tubes: values.tubes,
    pieces: values.pieces,
  });
  const preview = parsed.success
    ? calculateBilling({
        players,
        billing: {
          ...emptyBilling(),
          expenses: parsed.data,
          calculatorExcluded: values.excluded ?? [],
        },
      })
    : null;
  const persist = async (next: boolean) => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    if (!parsed.success || !preview) return;
    setBusy(true);
    try {
      const result = await save(parsed.data, values.excluded ?? []);
      setFailure(result.ok ? null : result.error);
      if (result.ok && next)
        continueBilling(preview.baseShare, values.excluded ?? []);
    } finally {
      setBusy(false);
    }
  };
  const numberField = (
    name: keyof Expenses,
    label: string,
    decimal = false,
  ) => (
    <Form.Item
      name={name}
      label={label}
      rules={[{ required: true, message: `Enter ${label.toLowerCase()}` }]}
    >
      <InputNumber
        aria-label={label}
        min={name === "piecesPerTube" ? 1 : 0}
        max={decimal ? 10000000 : 1000000}
        precision={decimal ? 2 : 0}
        disabled={busy}
        style={{ width: "100%" }}
      />
    </Form.Item>
  );
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={() => persist(false)}
    >
      <p className={styles.guideIntro}>
        Start with your expected costs. This estimate is a guide for choosing a
        payment amount; it never assigns or changes anyone’s bill.
      </p>
      {failure && <Alert type="error" title={failure} />}
      <fieldset className={styles.costGroup}>
        <legend>Court booking</legend>
        {numberField("courtFee", "Court fees (PHP)", true)}
      </fieldset>
      <fieldset className={styles.costGroup}>
        <legend>Shuttlecocks</legend>
        {numberField("tubePrice", "Price per tube (PHP)", true)}
        <div className={styles.usage}>
          {numberField("tubes", "Tubes used")}
          {numberField("pieces", "Extra pieces used")}
        </div>
        <details className={styles.tubeSettings}>
          <summary>
            Tube size · {values.piecesPerTube ?? "—"} pieces per tube
          </summary>
          {numberField("piecesPerTube", "Pieces per tube")}
        </details>
      </fieldset>
      <fieldset className={styles.costGroup}>
        <legend>Players sharing these costs</legend>
        <p>
          {players.length} players on the list. Leave out yourself or anyone you
          do not want in this estimate.
        </p>
        <Form.Item name="excluded" label="Exclude from cost calculation">
          <Select
            aria-label="Exclude from cost calculation"
            mode="multiple"
            options={players.map((p) => ({ value: p.id, label: p.name }))}
            optionFilterProp="label"
            placeholder="Everyone is included"
            disabled={busy}
          />
        </Form.Item>
        <p className={styles.guideHint}>
          Attendance does not affect this count. Your selected exclusions carry
          into billing, where you can still change them.
        </p>
      </fieldset>
      <div
        className={styles.calculation}
        aria-live="polite"
        data-testid="cost-estimate"
      >
        <div>
          <span>Court fees</span>
          <strong>{parsed.success ? money(parsed.data.courtFee) : "—"}</strong>
        </div>
        <div>
          <span>Shuttlecock cost</span>
          <strong>{preview ? money(preview.shuttleCost) : "—"}</strong>
        </div>
        <div className={styles.costTotal}>
          <span>Total estimated cost</span>
          <strong>{preview ? money(preview.totalExpenses) : "—"}</strong>
        </div>
        <div>
          <span>Players in estimate</span>
          <strong>{preview ? preview.calculatorCount : "—"}</strong>
        </div>
        <div className={styles.suggestion}>
          <span>Suggested amount per player</span>
          <strong>
            {preview?.baseShare === null || !preview
              ? "—"
              : money(preview.baseShare)}
          </strong>
        </div>
        <p>
          {!preview
            ? "Complete the costs above to see your estimate."
            : preview.baseShare === null
              ? "Include at least one player to calculate a per-head guide."
              : `${money(preview.totalExpenses)} ÷ ${preview.calculatorCount} players = ${money(preview.baseShare)} each`}
        </p>
        <p>
          You decide the final amount. You can round it up or down, then add
          individual discounts or overrides.
        </p>
      </div>
      <Space wrap className={styles.guideActions}>
        {canBill && (
          <Button
            type="primary"
            aria-label="Continue to set billing"
            loading={busy}
            disabled={!preview || preview.baseShare === null}
            onClick={() => persist(true)}
          >
            Continue to set billing
          </Button>
        )}
        <Button aria-label="Save estimate" htmlType="submit" loading={busy}>
          Save estimate
        </Button>
      </Space>
      <p className={styles.guideHint}>
        Saving or continuing saves this estimate only. Players are charged after
        you review and apply billing.
      </p>
    </Form>
  );
}
function BillingEditor({
  row,
  save,
  close,
}: {
  row: Row;
  save: (v: Arrangement) => Promise<ActionResult>;
  close: () => void;
}) {
  const [kind, setKind] = useState(row.arrangement?.kind ?? "shared");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [form] = Form.useForm();
  const amount = Form.useWatch("amount", form) ?? 0;
  const discount = Form.useWatch("discount", form) ?? 0;
  return (
    <Modal title={`Billing · ${row.name}`} open onCancel={close} footer={null}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          kind,
          amount:
            row.arrangement && "amount" in row.arrangement
              ? row.arrangement.amount / 100
              : 0,
          discount:
            row.arrangement && "discount" in row.arrangement
              ? (row.arrangement.discount ?? 0) / 100
              : 0,
          note:
            row.arrangement && "note" in row.arrangement
              ? (row.arrangement.note ?? "")
              : "",
        }}
        onFinish={async (v) => {
          const fields = {
            amount: Math.round(v.amount * 100),
            discount: Math.round(v.discount * 100),
            note: v.note ?? "",
          };
          const values: Arrangement =
            kind === "none"
              ? { kind }
              : kind === "separate"
                ? { kind, ...fields }
                : { kind: "shared", adjustment: "fixed", ...fields };
          setBusy(true);
          try {
            const result = await save(values);
            if (result.ok) close();
            else setFailure(result.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {failure && <Alert type="error" title={failure} />}
        <Form.Item name="kind" label="Billing arrangement">
          <Select
            aria-label="Billing arrangement"
            options={arrangements}
            onChange={setKind}
          />
        </Form.Item>
        {kind !== "none" && (
          <>
            <Form.Item
              name="amount"
              label="Charge amount (PHP)"
              rules={[{ required: true }]}
            >
              <InputNumber
                aria-label="Charge amount"
                min={0}
                max={10000000}
                precision={2}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              name="discount"
              label="Discount (PHP)"
              rules={[{ required: true }]}
            >
              <InputNumber
                aria-label="Discount (PHP)"
                min={0}
                max={amount}
                precision={2}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item name="note" label="Billing note">
              <Input
                maxLength={200}
                placeholder="e.g. Student discount or no-show charge"
              />
            </Form.Item>
            <p>
              Amount due:{" "}
              <strong>
                {money(Math.max(0, Math.round((amount - discount) * 100)))}
              </strong>
            </p>
          </>
        )}
        <p>
          This amount stays the same when costs, player count, or attendance
          change. You can assign a higher or lower charge to this person.
        </p>
        <Button type="primary" htmlType="submit" loading={busy}>
          Save billing
        </Button>
      </Form>
    </Modal>
  );
}
function BulkBilling({
  rows,
  save,
  close,
  suggestion,
  initialExcluded,
}: {
  rows: Row[];
  initialExcluded: string[];
  suggestion: number | null;
  save: Actions["setPlayerCharges"];
  close: () => void;
}) {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const [excluded, setExcluded] = useState<string[]>(() =>
    initialExcluded.filter((id) => rows.some((row) => row.id === id)),
  );
  const [amount, setAmount] = useState<number | null>(
    suggestion === null ? null : suggestion / 100,
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const selected = rows.filter((r) => !excluded.includes(r.id));
  const charge = amount === null ? null : Math.round(amount * 100);
  const rounded =
    suggestion === null ? null : Math.ceil(suggestion / 1000) * 1000;
  const visible = rows.filter((r) =>
    r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const setIncluded = (ids: string[], include: boolean) =>
    setExcluded((previous) =>
      include
        ? previous.filter((id) => !ids.includes(id))
        : [...new Set([...previous, ...ids])],
    );
  return (
    <Modal
      title="Set billing for players"
      open
      width={680}
      style={{
        top: 16,
        paddingBottom: 0,
        maxWidth: "calc(100vw - 24px)",
        marginInline: "auto",
      }}
      styles={{
        container: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 32px)",
          boxSizing: "border-box",
        },
        header: { flexShrink: 0, paddingRight: 32 },
        body: {
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
        },
        footer: {
          flexShrink: 0,
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--ant-color-border-secondary)",
        },
      }}
      onCancel={() => {
        if (!busy) close();
      }}
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      footer={
        <div
          data-testid="bulk-billing-footer"
          style={{
            display: "flex",
            flexDirection: screens.sm ? "row" : "column",
            alignItems: screens.sm ? "center" : "stretch",
            justifyContent: "space-between",
            gap: 12,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography.Text type="secondary">
              {selected.length} players · Total assigned
            </Typography.Text>
            <Typography.Text
              strong
              style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}
            >
              {charge === null ? "—" : money(charge * selected.length)}
            </Typography.Text>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              style={{ flex: screens.sm ? undefined : 1, minHeight: 40 }}
              onClick={close}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              style={{ flex: screens.sm ? undefined : 1, minHeight: 40 }}
              type="primary"
              onClick={() => form.submit()}
              disabled={!selected.length || charge === null}
              loading={busy}
            >
              Apply billing
            </Button>
          </div>
        </div>
      }
    >
      <Typography.Paragraph type="secondary" style={{ margin: "4px 0 16px" }}>
        Choose a fee and review who will pay. Changes take effect only after you
        apply billing.
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          amount: suggestion === null ? undefined : suggestion / 100,
        }}
        onFinish={async () => {
          if (charge === null) return;
          setBusy(true);
          try {
            const result = await save(
              selected.map((r) => r.id),
              rows
                .filter((r) => excluded.includes(r.id) && !r.arrangement)
                .map((r) => r.id),
              charge,
            );
            if (result.ok) close();
            else setFailure(result.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <AntRow gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Amount per player (PHP)"
              name="amount"
              rules={[{ required: true }]}
              style={{ marginBottom: 8 }}
            >
              <InputNumber
                aria-label="Amount per player (PHP)"
                prefix="₱"
                min={0}
                max={10000000}
                precision={2}
                onChange={setAmount}
                disabled={busy}
                size="large"
                style={{ width: "100%" }}
              />
            </Form.Item>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "4px 8px",
                marginBottom: 16,
              }}
            >
              {suggestion !== null && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Calculator guide: {money(suggestion)} per player
                </Typography.Text>
              )}
              {rounded !== null && rounded !== suggestion && (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => {
                    form.setFieldValue("amount", rounded / 100);
                    setAmount(rounded / 100);
                  }}
                >
                  Use {money(rounded)}
                </Button>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Exclude from bulk billing (optional)"
              style={{ marginBottom: 16 }}
            >
              <Select
                aria-label="Exclude from bulk billing"
                mode="multiple"
                value={excluded}
                onChange={setExcluded}
                options={rows.map((r) => ({ value: r.id, label: r.name }))}
                optionFilterProp="label"
                placeholder="Everyone is included"
                maxTagCount="responsive"
                disabled={busy}
                size="large"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
        </AntRow>
      </Form>
      <Card size="small" styles={{ body: { padding: 12 } }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Typography.Text strong>
            Apply to {selected.length} player{selected.length === 1 ? "" : "s"}
          </Typography.Text>
          <Tag
            color="green"
            style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}
          >
            {charge === null ? "Choose an amount" : `${money(charge)} each`}
          </Tag>
        </div>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: "6px 0 0", fontSize: 12 }}
        >
          Selected players’ charges and discounts will be replaced. Recorded
          payments stay unchanged.
        </Typography.Paragraph>
        {excluded.length > 0 && (
          <Typography.Paragraph
            type="secondary"
            style={{ margin: "4px 0 0", fontSize: 12 }}
          >
            {excluded.length} excluded · Existing bills stay unchanged;
            unassigned players become No charge.
          </Typography.Paragraph>
        )}
      </Card>
      <section aria-label="Billing preview" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <Typography.Text strong>Review players</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {selected.length} of {rows.length} selected
          </Typography.Text>
        </div>
        <Input
          aria-label="Search billing preview"
          placeholder="Search players"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ marginBottom: 8 }}
        />
        <div
          role="region"
          aria-label="Player charge preview"
          style={{ minWidth: 0 }}
        >
          <Table<Row>
            size="small"
            rowKey="id"
            tableLayout="fixed"
            dataSource={visible}
            locale={{ emptyText: "No players match your search." }}
            onRow={() => ({
              "data-testid": "bulk-player-preview",
              style: { verticalAlign: "middle" },
            })}
            rowSelection={{
              columnWidth: 36,
              selectedRowKeys: selected.map((r) => r.id),
              preserveSelectedRowKeys: true,
              getCheckboxProps: () => ({ disabled: busy }),
              onSelect: (row, include) => setIncluded([row.id], include),
              onSelectAll: (include, _selected, changed) =>
                setIncluded(
                  changed.map((r) => r.id),
                  include,
                ),
            }}
            columns={[
              {
                title: "Player",
                dataIndex: "name",
                key: "player",
                ellipsis: true,
                render: (name: string, row) => (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <Typography.Text ellipsis={{ tooltip: name }}>
                      {name}
                    </Typography.Text>
                    {excluded.includes(row.id) && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 11 }}
                      >
                        {row.arrangement ? "Bill unchanged" : "Excluded"}
                      </Typography.Text>
                    )}
                  </div>
                ),
              },
              {
                title: "Amount due",
                key: "charge",
                width: 112,
                align: "right",
                render: (_value, row) => (
                  <Typography.Text
                    strong
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {excluded.includes(row.id)
                      ? row.arrangement
                        ? money(row.charge ?? 0)
                        : "No charge"
                      : charge === null
                        ? "—"
                        : money(charge)}
                  </Typography.Text>
                ),
              },
            ]}
            pagination={{
              current: page,
              onChange: setPage,
              pageSize: 5,
              showSizeChanger: false,
              hideOnSinglePage: true,
              size: "small",
              simple: !screens.sm,
            }}
          />
        </div>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, margin: "4px 0 0" }}
        >
          Uncheck a player to leave them out of this update.
        </Typography.Paragraph>
      </section>
      {failure && (
        <Alert type="error" title={failure} style={{ marginTop: 12 }} />
      )}
    </Modal>
  );
}
function ReceiptEditor({
  row,
  receipt,
  full,
  save,
  close,
}: {
  row: Row;
  receipt?: Receipt;
  full: boolean;
  save: (v: Receipt, original?: Receipt) => Promise<ActionResult>;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const localDate = (time: number) => {
    const d = new Date(time);
    return new Date(time - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const [receiptId] = useState(() => receipt?.id ?? crypto.randomUUID());
  return (
    <Modal
      title={`${receipt ? "Edit payment" : full ? "Mark fully paid" : "Record payment"} · ${row.name}`}
      open
      onCancel={close}
      footer={null}
    >
      <p>
        Charge {row.charge === null ? "unassigned" : money(row.charge)} ·
        Received {money(row.received)} · Balance {money(row.balance)}
      </p>
      <Form
        layout="vertical"
        initialValues={{
          amount: receipt
            ? receipt.amount / 100
            : full
              ? row.balance / 100
              : undefined,
          method: receipt?.method ?? "cash",
          paidAt: localDate(receipt?.paidAt ?? Date.now()),
          note: receipt?.note ?? "",
        }}
        onFinish={async (v) => {
          setBusy(true);
          try {
            const r = await save(
              {
                id: receiptId,
                playerId: row.id,
                amount: Math.round(v.amount * 100),
                method: v.method,
                paidAt: new Date(v.paidAt).getTime(),
                note: v.note ?? "",
              },
              receipt,
            );
            if (r.ok) close();
            else setFailure(r.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {failure && <Alert type="error" title={failure} />}
        <Form.Item
          name="amount"
          label="Payment amount (PHP)"
          rules={[{ required: true }, { type: "number", min: 0.01 }]}
        >
          <InputNumber
            aria-label="Payment amount (PHP)"
            min={0.01}
            max={10000000}
            precision={2}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item
          name="method"
          label="Payment method"
          rules={[{ required: true }]}
        >
          <Select
            aria-label="Payment method"
            options={[
              { value: "cash", label: "Cash" },
              { value: "digital", label: "Digital" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="paidAt"
          label="Payment date and time"
          rules={[{ required: true }]}
        >
          <Input aria-label="Payment date and time" type="datetime-local" />
        </Form.Item>
        <Form.Item name="note" label="Note">
          <Input.TextArea maxLength={500} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>
          Save payment
        </Button>
      </Form>
    </Modal>
  );
}
export default function PaymentsPanel({
  session,
  actions,
  open,
  close,
  playerFilter,
}: {
  session: QueueData;
  actions: Actions;
  open: boolean;
  close: () => void;
  playerFilter?: string;
}) {
  const totals = calculateBilling(session);
  const finalized = !!session.billing.finalized;
  const [showFinalExpenses, setShowFinalExpenses] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [kind, setKind] = useState("All");
  const [focused, setFocused] = useState(true);
  const [bulkGuide, setBulkGuide] = useState<{
    suggestion: number | null;
    excluded: string[];
  } | null>(null);
  const [billingId, setBillingId] = useState<string | null>(null);
  const [payment, setPayment] = useState<{
    playerId: string;
    receipt?: Receipt;
    full: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{
    totals: typeof totals;
    finalize: () => Promise<ActionResult>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (promise: Promise<ActionResult>) => {
    const r = await promise;
    setError(r.ok ? null : r.error);
    return r;
  };
  const billingRow = totals.rows.find((r) => r.id === billingId);
  const paymentRow = totals.rows.find((r) => r.id === payment?.playerId);
  const visible = totals.rows.filter(
    (r) =>
      (!focused || !playerFilter || r.id === playerFilter) &&
      r.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "All" || r.status === status) &&
      (kind === "All" || (r.arrangement?.kind ?? "unassigned") === kind),
  );
  return (
    <Drawer
      title="Payments"
      open={open}
      onClose={close}
      size="large"
      styles={{ wrapper: { maxWidth: "100vw" } }}
    >
      <div className={styles.panel}>
        <Alert
          type={finalized ? "success" : "info"}
          showIcon
          title={
            finalized
              ? "Final charges · collections remain open"
              : "Calculate first, then choose what to collect"
          }
          description={
            finalized
              ? "Reopen settlement to correct assigned charges. The cost calculator remains independent."
              : "Start with an estimate, choose a fixed fee, then record payments. You can adjust individual players after applying the fee."
          }
        />
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            closable
            onClose={() => setError(null)}
          />
        )}
        <Card
          title="1. Calculate your costs"
          extra={
            finalized && (
              <Button
                size="small"
                aria-expanded={showFinalExpenses}
                onClick={() => setShowFinalExpenses(!showFinalExpenses)}
              >
                {showFinalExpenses ? "Hide details" : "Show details"}
              </Button>
            )
          }
          size="small"
        >
          {(!finalized || showFinalExpenses) && (
            <ExpenseForm
              key={JSON.stringify([
                session.billing.expenses,
                session.billing.calculatorExcluded,
              ])}
              expenses={session.billing.expenses}
              canBill={!finalized}
              continueBilling={(suggestion, excluded) =>
                setBulkGuide({ suggestion, excluded })
              }
              excluded={session.billing.calculatorExcluded}
              players={totals.rows}
              save={(v, excluded) => run(actions.setExpenses(v, excluded))}
            />
          )}
          {finalized && !showFinalExpenses && (
            <p>
              Estimated cost {money(totals.totalExpenses)} ·{" "}
              {totals.calculatorCount} players · Guide per player{" "}
              {totals.baseShare === null ? "—" : money(totals.baseShare)}
            </p>
          )}
        </Card>
        <div className={styles.billingStep}>
          <div>
            <strong>2. Set player billing</strong>
            <p>Choose a fixed amount and the players who will pay it.</p>
          </div>
          <Button
            disabled={finalized || !totals.rows.length}
            onClick={() =>
              setBulkGuide({
                suggestion: totals.baseShare,
                excluded: session.billing.calculatorExcluded,
              })
            }
          >
            Set billing for players
          </Button>
        </div>
        <div className={styles.totals}>
          {(
            [
              ["Assigned charges", totals.sharedCharges],
              ["Separate charges", totals.separateCharges],
              ["Cash received", totals.cash],
              ["Digital received", totals.digital],
              ["Total received", totals.received],
              ["Outstanding", totals.outstanding],
              ["Credits", totals.credits],
              [
                totals.difference < 0 ? "Cost shortfall" : "Cost surplus",
                Math.abs(totals.difference),
              ],
            ] as const
          ).map(([label, amount]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{money(amount)}</strong>
            </div>
          ))}
        </div>
        <Space wrap>
          {finalized ? (
            <Popconfirm
              title="Reopen settlement?"
              description="Charges become provisional. All receipts are preserved."
              onConfirm={() => run(actions.reopenBilling())}
            >
              <Button>Reopen settlement</Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              disabled={session.sessionStatus !== "ended"}
              onClick={() =>
                setReview({ totals, finalize: actions.finalizeBilling })
              }
            >
              Review final settlement
            </Button>
          )}
          {!finalized && session.sessionStatus !== "ended" && (
            <Typography.Text type="secondary">
              Finalize after ending the session.
            </Typography.Text>
          )}
        </Space>
        <div className={styles.collectionStep}>
          <strong>3. Record payments</strong>
          <p>
            Track cash and digital payments against each player’s assigned bill.
          </p>
        </div>
        <div className={styles.filters}>
          <Input
            aria-label="Search payments"
            placeholder="Search players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            aria-label="Payment status filter"
            value={status}
            onChange={setStatus}
            options={[
              "All",
              "No payment",
              "Partially paid",
              "Fully paid",
              "Unassigned",
              "No charge",
            ].map((value) => ({
              value,
              label: value === "All" ? "All statuses" : value,
            }))}
          />
          <Select
            aria-label="Billing arrangement filter"
            value={kind}
            onChange={setKind}
            options={[
              { value: "All", label: "All arrangements" },
              { value: "unassigned", label: "Unassigned" },
              ...arrangements,
            ]}
          />
        </div>
        {focused && playerFilter && (
          <Button onClick={() => setFocused(false)}>Show all players</Button>
        )}
        {!visible.length && <Empty description="No players match this view" />}
        {visible.map((row) => (
          <Card
            key={row.id}
            size="small"
            data-testid="payment-player"
            title={
              <Space wrap>
                <span>{row.name}</span>
                <PaymentTag row={row} finalized={finalized} />
              </Space>
            }
          >
            <p>
              {arrangements.find((a) => a.value === row.arrangement?.kind)
                ?.label ?? "Unassigned"}
              {row.arrangement &&
              "discount" in row.arrangement &&
              (row.arrangement.discount ?? 0) > 0
                ? ` · Discount ${money(row.arrangement.discount!)}`
                : ""}
              {row.arrangement &&
              "note" in row.arrangement &&
              row.arrangement.note
                ? ` · ${row.arrangement.note}`
                : ""}
            </p>
            <div className={styles.amounts}>
              <span>
                Charge{" "}
                <strong>{row.charge === null ? "—" : money(row.charge)}</strong>
              </span>
              <span>
                Cash <strong>{money(row.cash)}</strong>
              </span>
              <span>
                Digital <strong>{money(row.digital)}</strong>
              </span>
              <span>
                Balance <strong>{money(row.balance)}</strong>
              </span>
              {row.credit > 0 && (
                <span>
                  Credit <strong>{money(row.credit)}</strong>
                </span>
              )}
            </div>
            <Space wrap>
              <Button disabled={finalized} onClick={() => setBillingId(row.id)}>
                Set billing
              </Button>
              <Button
                onClick={() => setPayment({ playerId: row.id, full: false })}
              >
                Record payment
              </Button>
              <Button
                disabled={row.balance <= 0}
                onClick={() => setPayment({ playerId: row.id, full: true })}
              >
                Mark fully paid
              </Button>
            </Space>
            {row.receipts.length > 0 && (
              <details className={styles.receipts}>
                <summary>Payment history ({row.receipts.length})</summary>
                {row.receipts.map((receipt) => (
                  <div key={receipt.id} className={styles.receipt}>
                    <span>
                      <strong>{money(receipt.amount)}</strong> ·{" "}
                      {receipt.method === "cash" ? "Cash" : "Digital"}
                      <br />
                      <small>
                        {new Date(receipt.paidAt).toLocaleString()}
                        {receipt.note ? ` · ${receipt.note}` : ""}
                      </small>
                    </span>
                    <Space wrap>
                      <Button
                        size="small"
                        onClick={() =>
                          setPayment({ playerId: row.id, receipt: structuredClone(receipt), full: false })
                        }
                      >
                        Edit
                      </Button>
                      <Popconfirm
                        title="Delete this payment?"
                        onConfirm={() => run(actions.deleteReceipt(receipt.id))}
                      >
                        <Button size="small" danger>
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </details>
            )}
          </Card>
        ))}
      </div>
      {bulkGuide && (
        <BulkBilling
          rows={totals.rows}
          suggestion={bulkGuide.suggestion}
          initialExcluded={bulkGuide.excluded}
          save={(ids, exempt, amount) =>
            run(actions.setPlayerCharges(ids, exempt, amount))
          }
          close={() => setBulkGuide(null)}
        />
      )}
      {billingRow && (
        <BillingEditor
          row={billingRow}
          save={(v) => run(actions.setArrangement(billingRow.id, v))}
          close={() => setBillingId(null)}
        />
      )}
      {paymentRow && payment && (
        <ReceiptEditor
          row={paymentRow}
          receipt={payment.receipt}
          full={payment.full}
          save={(v, original) => run(actions.saveReceipt(v, original))}
          close={() => setPayment(null)}
        />
      )}
      <Modal
        title="Review final settlement"
        open={!!review}
        onCancel={() => setReview(null)}
        okText="Finalize charges"
        confirmLoading={busy}
        okButtonProps={{
          disabled: review?.totals.rows.some((r) => !r.arrangement),
        }}
        onOk={async () => {
          if (!review) return;
          setBusy(true);
          try {
            await run(review.finalize());
            setReview(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Review the amounts you assigned to each person. The calculator does
          not change these charges. Payments remain editable after finalization.
        </p>
        {review?.totals.rows.some((r) => !r.arrangement) && (
          <Alert
            type="warning"
            title="Choose billing for every player before finalizing."
          />
        )}
        <div className={styles.review}>
          {review?.totals.rows.map((row) => (
            <div key={row.id}>
              <strong>{row.name}</strong>
              <p>
                Start estimate{" "}
                {session.billing.estimate?.[row.id] === undefined
                  ? "—"
                  : money(session.billing.estimate[row.id])}{" "}
                → Final {row.charge === null ? "Unassigned" : money(row.charge)}
              </p>
              <p>
                Received {money(row.received)} · Balance {money(row.balance)} ·
                Credit {money(row.credit)}
              </p>
            </div>
          ))}
        </div>
        <p>
          Final expenses {money(review?.totals.totalExpenses ?? 0)} ·
          Outstanding {money(review?.totals.outstanding ?? 0)}
        </p>
      </Modal>
    </Drawer>
  );
}
