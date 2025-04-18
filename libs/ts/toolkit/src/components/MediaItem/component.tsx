import * as React from 'react';
import { Container, Image, Children, HoverAdornment } from './styles';

export interface MediaItemProps<T extends string = string> {
	className?: string;
	style?: React.CSSProperties;
	id?: T;
	src: string;
	size?: number;
	disabled?: boolean;
	locked?: boolean;
	hoverAdornment?: React.ReactNode;
	fallback?: React.ReactNode;
	onClick?(src: string, id?: T): void;
	children?: React.ReactNode;
}

export const MediaItem = <T extends string = string>({
	className,
	style,
	id,
	size = 84,
	disabled = false,
	locked = false,
	src,
	onClick = () => undefined,
	fallback = null,
	hoverAdornment,
	children,
}: MediaItemProps<T>) => {
	const [error, setError] = React.useState(false);
	const handleClick = React.useCallback(() => !locked && onClick(src, id), [
		src,
		onClick,
		id,
		locked,
	]);

	React.useEffect(() => setError(false), [src]);

	return (
		<Container
			className={className}
			style={style}
			disabled={disabled}
			$locked={locked}
			size={size}
			onClick={handleClick}
		>
			{
				error ?
					fallback
					:
					<Image src={src} imageProps={{onError: () => setError(true)}} />
			}
			<HoverAdornment>
				{typeof hoverAdornment !== 'undefined' ? hoverAdornment :  null}
			</HoverAdornment>
			<Children>{children}</Children>
		</Container>
	);
};
