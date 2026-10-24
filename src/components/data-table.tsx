"use client";

import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/**
 * Таблица с поиском и пагинацией. На экранах < md строки превращаются в карточки,
 * чтобы на телефонах не было горизонтальной прокрутки и обрезанных кнопок.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Поиск…",
  toolbar,
  pageSize = 8,
  empty = "Ничего не найдено",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  pageSize?: number;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !searchText) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(needle));
  }, [rows, q, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {searchText && (
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="input pl-9"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              maxLength={100}
            />
          </div>
        )}
        {toolbar}
        <span className="ml-auto text-xs text-muted">Записей: {filtered.length}</span>
      </div>

      {slice.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
          <SearchX className="h-6 w-6" aria-hidden />
          {empty}
        </div>
      ) : (
        <>
          <div className="table-wrap hidden md:block">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className="th">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr key={rowKey(row)} className="transition hover:bg-panel-2/50">
                    {columns.map((c) => (
                      <td key={c.key} className={`td ${c.className ?? ""}`}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {slice.map((row) => (
              <li key={rowKey(row)} className="card space-y-2.5 p-4">
                {columns.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-4 text-sm">
                    <span className="shrink-0 text-xs text-muted">{c.header}</span>
                    <span className="min-w-0 break-words text-right">{c.render(row)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Страницы таблицы">
          <button type="button" className="btn-ghost !px-3 !py-2" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted">
            {safePage} / {totalPages}
          </span>
          <button type="button" className="btn-ghost !px-3 !py-2" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Вперёд">
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
