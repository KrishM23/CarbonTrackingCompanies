type Props = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
};

const SIZES = {
  sm: 26,
  md: 34,
  lg: 52,
} as const;

export function BrandLogo({ size = "md", withWordmark = false, className = "" }: Props) {
  const h = SIZES[size];
  return (
    <span className={`brand-lockup ${className}`.trim()}>
      <img
        className="brand-mark"
        src="/vapor-logo-light.png"
        alt=""
        height={h}
        width={Math.round(h * 0.45)}
        draggable={false}
      />
      {withWordmark && <span className="brand-wordmark">Vapor</span>}
    </span>
  );
}
