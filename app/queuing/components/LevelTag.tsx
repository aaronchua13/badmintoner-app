import React from "react";
import { PlayerLevel } from "../types";
import styles from "./LevelTag.module.css";

interface LevelTagProps {
  level: PlayerLevel;
  style?: React.CSSProperties;
}

export default function LevelTag({ level, style }: LevelTagProps) {
  return (
    <span className={styles.badge} data-level={level} data-family={level.split(" ")[0]} style={style}>
      {level.replace(" -", " −")}
    </span>
  );
}
