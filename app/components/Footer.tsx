'use client';

import React from 'react';
import { Layout, Typography } from 'antd';

const { Footer: AntFooter } = Layout;
const { Text } = Typography;

const Footer: React.FC = () => {
  return (
    <AntFooter style={{ textAlign: 'center', background: '#f0f2f5', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Text style={{ fontSize: '14px' }}>
          Badmintoner © 2026 · Built with ❤️ by Nooons
        </Text>
      </div>
    </AntFooter>
  );
};

export default Footer;
