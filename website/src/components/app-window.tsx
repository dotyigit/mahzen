export interface AppWindowProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
}

export default function AppWindow({ src, className, ...props }: AppWindowProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Mahzen screenshot"
      className={className}
      {...props}
    />
  );
}
