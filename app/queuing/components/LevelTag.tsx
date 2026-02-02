import React from 'react';
import { Tag } from 'antd';
import { PlayerLevel, LEVEL_COLORS, LEVEL_TEXT_COLORS, LEVEL_SHORT_TEXT } from '../types';

interface LevelTagProps {
  level: PlayerLevel;
  style?: React.CSSProperties;
}

const LevelTag: React.FC<LevelTagProps> = ({ level, style }) => (
  <Tag 
    style={{ 
      backgroundColor: LEVEL_COLORS[level],
      color: LEVEL_TEXT_COLORS[level],
      margin: 0, 
      fontSize: '10px', 
      lineHeight: '16px', 
      padding: '0 4px',
      border: 'none',
      fontWeight: 600,
      ...style
    }}
  >
    {LEVEL_SHORT_TEXT[level]}
  </Tag>
);

export default LevelTag;
