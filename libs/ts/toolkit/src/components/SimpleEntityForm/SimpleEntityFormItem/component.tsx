import * as React from 'react';
import { FormItemProps } from '../../FormItem';
import { StyledFormItem } from './styles';

export interface SimpleEntityFormItemProps extends FormItemProps {
	className?: string;
	style?: React.CSSProperties;
	id: string;
}

export const SimpleEntityFormItem: React.FC<SimpleEntityFormItemProps> = ({
	align = { direction: 'row', basis: { label: '30%', value: '70%' } },
	...p
}) => <StyledFormItem align={align} {...p} />;
