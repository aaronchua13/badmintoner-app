import { useHydrated } from '../../hooks/useHydrated';
import React from "react";
import {
  Modal,
  Form,
  InputNumber,
  Divider,
  type FormInstance,
  Radio,
} from "antd";
import { Court, Player } from "../../types";

interface FinishMatchModalProps {
  visible: boolean;
  onCancel: () => void;
  onFinish: (values: {
    team1Score?: number;
    team2Score?: number;
    winningTeam?: number;
  }) => void;
  form: FormInstance;
  court: Court | undefined;
  players: Player[];
}

const FinishMatchModal: React.FC<FinishMatchModalProps> = ({
  visible,
  onCancel,
  onFinish,
  form,
  court,
  players,
}) => {
  const hydrated = useHydrated();
  const score1 = Form.useWatch("team1Score", form);
  const score2 = Form.useWatch("team2Score", form);
  const hasScores = score1 !== undefined && score2 !== undefined;
  const scoreRules = (other: string) => [
    ({ getFieldValue }: Pick<FormInstance, "getFieldValue">) => ({
      validator: (_: unknown, value: number | undefined) => {
        const opponent = getFieldValue(other);
        if ((value === undefined) !== (opponent === undefined))
          return Promise.reject(new Error("Enter both scores, or leave both empty"));
        if (value !== undefined && (!Number.isInteger(value) || value < 0))
          return Promise.reject(new Error("Scores must be non-negative whole numbers"));
        if (value !== undefined && value === opponent)
          return Promise.reject(new Error("Scores cannot be tied"));
        return Promise.resolve();
      },
    }),
  ];
  const getTeamNames = (indices: number[]) => {
    if (!court) return "";
    return indices
      .map((i) => court.players[i])
      .filter(Boolean)
      .map((pid) => players.find((p) => p.id === pid)?.name)
      .join(" & ");
  };

  return (
    <Modal
      forceRender={hydrated}
      title="Finish Match"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={(changed, values) => {
          if (Object.hasOwn(changed, "team1Score") || Object.hasOwn(changed, "team2Score")) {
            const a = values.team1Score;
            const b = values.team2Score;
            form.setFieldValue(
              "winningTeam",
              a !== undefined && b !== undefined &&
              Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0 && a !== b
                ? (a > b ? 1 : 2)
                : undefined,
            );
          }
        }}
      >
        <div style={{ marginBottom: 8, color: "var(--ant-color-text-secondary)", fontSize: "12px" }}>
          Scores are optional
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Form.Item
            name="team1Score"
            normalize={(value) => value ?? undefined}
            dependencies={["team2Score"]}
            rules={scoreRules("team2Score")}
            label={`Team 1 (${getTeamNames([0, 1])})`}
            style={{ flex: 1 }}
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Optional"
            />
          </Form.Item>
          <div style={{ marginTop: 32 }}>-</div>
          <Form.Item
            name="team2Score"
            normalize={(value) => value ?? undefined}
            dependencies={["team1Score"]}
            rules={scoreRules("team1Score")}
            label={`Team 2 (${getTeamNames([2, 3])})`}
            style={{ flex: 1 }}
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Optional"
            />
          </Form.Item>
        </div>

        <Divider plain>{hasScores ? "Winner from scores" : "Who Won?"}</Divider>

        <Form.Item
          name="winningTeam"
          rules={[{ required: true, message: "Please select a winner" }]}
        >
          <Radio.Group disabled={hasScores} style={{ width: "100%", display: "flex" }}>
            <Radio.Button value={1} style={{ flex: 1, textAlign: "center" }}>
              Team 1
            </Radio.Button>
            <Radio.Button value={2} style={{ flex: 1, textAlign: "center" }}>
              Team 2
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FinishMatchModal;
