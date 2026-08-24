import { ReactNode, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Column-sort state for a table: click a header to sort by it, click again to flip direction. */
export function useSort<T, K extends string>(rows: T[], getters: Record<K, (row: T) => string | number>, initialKey?: K) {
  const [sortKey, setSortKey] = useState<K | null>(initialKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: K) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const getter = getters[sortKey];
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, getters]);

  return { sorted, sortKey, sortDir, onSort };
}

interface SortThProps<K extends string> {
  id: K;
  label: ReactNode;
  sortKey: K | null;
  sortDir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}

/** Clickable <th> with a sort-direction indicator, for use with useSort. */
export function SortTh<K extends string>({ id, label, sortKey, sortDir, onSort, className }: SortThProps<K>) {
  const active = sortKey === id;
  return (
    <th className={`th-sort ${active ? "active" : ""} ${className ?? ""}`} onClick={() => onSort(id)}>
      <span className="th-sort-inner">
        {label}
        <span className="sort-arrow">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </span>
    </th>
  );
}
