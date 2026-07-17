type Props = {
  text: string;
  className?: string;
};

/** Brand word that rises and dissolves into place, letter by letter. */
export function VaporTitle({ text, className = "" }: Props) {
  return (
    <h1 className={`vapor-title ${className}`.trim()} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="vapor-title-letter"
          style={{ animationDelay: `${80 + i * 70}ms` }}
          aria-hidden
        >
          {ch}
        </span>
      ))}
    </h1>
  );
}
