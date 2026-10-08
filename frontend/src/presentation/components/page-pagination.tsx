import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Pagination, PaginationContent, PaginationItem } from './ui/pagination';
export function PagePagination({
  total,
  offset,
  pageSize = 50,
  busy = false,
  unit,
  onPage,
  label = '列表分页',
  previousLabel = '上一页',
  nextLabel = '下一页',
}: {
  total: number;
  offset: number;
  pageSize?: number;
  busy?: boolean;
  unit: string;
  onPage: (offset: number) => void;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
}) {
  return (
    <Pagination aria-label={label} className="pagination">
      <span>
        共 {total} {unit}
      </span>
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || offset === 0}
            onClick={() => onPage(Math.max(0, offset - pageSize))}
          >
            <ChevronLeft size={14} />
            {previousLabel}
          </Button>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || offset + pageSize >= total}
            onClick={() => onPage(offset + pageSize)}
          >
            {nextLabel}
            <ChevronRight size={14} />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
