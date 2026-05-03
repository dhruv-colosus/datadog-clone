type Props = {
  size?: number;
};

export function HexLogo({ size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="11,4 21,4 27,9 27,19 21,24 11,24 5,19 5,9"
        fill="none"
        stroke="#1a73e8"
        strokeWidth="1.5"
      />
      <polygon
        points="14,10 20,10 23,14 20,18 14,18 11,14"
        fill="#1a73e8"
        opacity="0.3"
      />
      <polygon
        points="20,10 26,10 28,14 26,18 20,18 18,14"
        fill="#1a73e8"
        opacity="0.6"
      />
      <polygon
        points="8,14 14,14 17,18 14,22 8,22 5,18"
        fill="#1a73e8"
        opacity="0.45"
      />
    </svg>
  );
}
