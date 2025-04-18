import * as React from 'react';
import { Expander, ExpanderProps } from '../Expander';
import { Container } from './styles';

export interface SimpleEntityFormProps extends ExpanderProps {
	className?: string;
	style?: React.CSSProperties;
	title: ExpanderProps['title'];
	children: React.ReactNode;
}

export const SimpleEntityForm: React.FC<SimpleEntityFormProps> = ({
	className = '',
	style,
	isDefaultOpened = true,
	children,
	...p
}) => {
	return (
		<Expander isDefaultOpened={isDefaultOpened} {...p}>
			<Container>{children}</Container>
		</Expander>
	);
};
