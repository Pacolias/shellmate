import { useMemo, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { ParsedTable } from './table-parsers';
import styles from './TableView.module.css';

export interface TableViewProps {
  table: ParsedTable;
  onClose: () => void;
}

type SortState = { column: number; direction: 'asc' | 'desc' } | null;

export function TableView({ table, onClose }: TableViewProps) {
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(() => {
    if (!sort) return table.rows;
    const sorted = [...table.rows].sort((a, b) => compareCell(a[sort.column], b[sort.column]));
    return sort.direction === 'asc' ? sorted : sorted.reverse();
  }, [table.rows, sort]);

  const toggleSort = (column: number): void => {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: 'asc' };
      return current.direction === 'asc' ? { column, direction: 'desc' } : null;
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            {es.terminal.table.close}
          </button>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {table.headers.map((header, index) => (
                  <th key={header + index} onClick={() => toggleSort(index)} className={styles.th}>
                    {header}
                    {sort?.column === index ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={styles.td}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function compareCell(a: string | undefined, b: string | undefined): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && a !== '' && b !== '') {
    return aNum - bNum;
  }
  return (a ?? '').localeCompare(b ?? '');
}
