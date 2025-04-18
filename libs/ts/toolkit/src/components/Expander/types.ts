import * as React from 'react';

export type ExpanderSize = 'big' | 'medium' | 'small';

export interface ExpanderHeaderProps {
	title: React.ReactNode;
	isOpened: boolean;
	isStatic: boolean;
	isDefaultOpened: boolean;
	size: ExpanderSize;
	defaultHeader: React.ReactNode;
}

export interface ExpanderProps {
	className?: string;
	style?: React.CSSProperties;
	title?: React.ReactNode;
	size?: ExpanderSize;
	isStatic?: boolean;
	disabled?: boolean;
	isDefaultOpened?: boolean;
	isFullScreenWidth?: boolean;
	timeout?: number;
	headerRenderer?: (props: ExpanderHeaderProps) => React.ReactNode;
	indicator?: 'arrow' | 'plus';
	children: React.ReactNode;
}
