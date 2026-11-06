import { Tag } from "antd";
import { calculateBilling } from "../state/billing";
type Row = ReturnType<typeof calculateBilling>["rows"][number];
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
