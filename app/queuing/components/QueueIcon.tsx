import React from 'react';
import Icon from '@ant-design/icons';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';

const QueueSvg = () => (
  <svg width="1em" height="1em" viewBox="-5 -1 28 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="-3" width="3" height="3" rx="2" fill="currentColor"/>
    <rect x="-3" y="4" width="3" height="10" rx="1.5" fill="currentColor"/>
    <rect x="4" width="3" height="3" rx="2" fill="currentColor"/>
    <rect x="4" y="4" width="3" height="10" rx="1.5" fill="currentColor"/>
    <rect x="10.5" width="3" height="3" rx="2" fill="currentColor"/>
    <rect x="10.5" y="4" width="3" height="10" rx="1.5" fill="currentColor"/>
    <rect x="17" width="3" height="3" rx="2" fill="currentColor"/>
    <rect x="17" y="4" width="3" height="10" rx="1.5" fill="currentColor"/>
    <path d="M-2 19h22m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const QueueIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={QueueSvg} {...props} />
);
