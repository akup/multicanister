import * as React from 'react';
import { FooterContainer } from './styles';
import { ExpanderContextProps, ExpanderContext } from './context';

export interface FooterProps extends Partial<ExpanderContextProps> {
	className?: string;
	style?: React.CSSProperties;
	children: React.ReactChild | false | null | void;
}

export const Footer: React.FC<FooterProps> = ({
	children,
	...props
}) => {
	const contextProps = React.useContext(ExpanderContext);
	if (!children) {
		return null;
	}

	return (
		<FooterContainer {...contextProps} {...props}>
			{children}
		</FooterContainer>
	);
};
