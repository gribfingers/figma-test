import { ReactNode } from "react";

interface Props {
  label: string;
  error?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
}

/** Bordered field wrapper (label caption + boxed control) matching the app's input/select style. */
export function Field({ label, error, children, style }: Props) {
  return (
    <div className={`field2 ${error ? "error" : ""}`} style={style}>
      {children}
      <label>{label}</label>
    </div>
  );
}
