import React from "react";
import { Collapse, Modal } from "antd";
interface Props {
  visible: boolean;
  onClose: () => void;
}
export default function InstructionsModal({ visible, onClose }: Props) {
  return (
    <Modal
      title="Queuing guide"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={650}
    >
      <Collapse
        defaultActiveKey={["setup"]}
        items={[
          {
            key: "setup",
            label: "Set up your session",
            children: (
              <p>
                Add courts and players using the buttons in each section. Player
                Database lets you reuse a saved roster. Choose Compact for a
                tighter view or Comfortable for more space, then select Start
                Session.
              </p>
            ),
          },
          {
            key: "queue",
            label: "Build and assign matches",
            children: (
              <p>
                Create Match adds an upcoming match. Use Queue beside a player
                to choose their match. Each team holds two players. Move matches
                up or down with the arrow buttons, or drag the handle. Assign a
                match to an empty court when ready. You can also assign players
                directly using Court or Assign Players.
              </p>
            ),
          },
          {
            key: "results",
            label: "Finish, stop, or transfer a match",
            children: (
              <p>
                Finish Match records a winner, games, partner history, and
                optional scores. Enter both scores or leave both empty. Stop
                Match records an interruption without adding a game, win, or
                loss. Court options also let you transfer a match to an empty
                court without resetting its timer.
              </p>
            ),
          },
          {
            key: "end",
            label: "End a session and keep your results",
            children: (
              <p>
                Finish or stop every running match before choosing Session →
                Stop session. Review the summary or match history, and export a
                JSON backup. New session keeps your roster and courts while
                clearing results. Reset session clears the session, but keeps
                the reusable player database.
              </p>
            ),
          },
          {
            key: "storage",
            label: "Saving, multiple tabs, and offline use",
            children: (
              <p>
                Changes save in this browser on this device. Tabs on the same
                site share committed changes. After opening the production page
                online once, it can reopen offline. This is not cloud backup:
                export sessions you need to keep before clearing browser data.
                Invalid imports leave the current session unchanged.
              </p>
            ),
          },
          {
            key: "stats",
            label: "Statistics and availability",
            children: (
              <p>
                Games, wins, losses, and partners update after completed
                matches. Total idle time counts waiting between games, rather
                than time before a first completed game. Mark away removes a
                player from pending assignments. Player details include full
                statistics and history.
              </p>
            ),
          },
        ]}
      />
    </Modal>
  );
}
