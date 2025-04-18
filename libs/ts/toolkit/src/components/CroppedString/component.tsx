import React from 'react';
import * as MaterialUI from '@mui/material';
import { Container, Id } from './styles';
import { cropString } from './utils';

export interface CroppedStringProps extends React.ComponentProps<typeof MaterialUI.Typography>, IClassName {
	loading?: boolean;
	startLen?: number;
	endLen?: number;
	onClick?(e: React.MouseEvent): void;
	children: string;
}

export const CroppedString: React.FC<CroppedStringProps> = ({
	className = '',
	style,
	startLen = 7,
	endLen = 5,
	children,
	...p
}) =>
	p.loading ? (
		<MaterialUI.CircularProgress color='inherit' size={24} />
	) : (
		<MaterialUI.Tooltip title={children} placement='top'>
			<Container className={className} style={style} onClick={p.onClick}>
				<Id {...p} len={startLen + endLen}>
					{cropString(children, startLen, endLen)}
				</Id>
			</Container>
		</MaterialUI.Tooltip>
	);
