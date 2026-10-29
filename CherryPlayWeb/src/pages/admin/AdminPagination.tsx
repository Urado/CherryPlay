import { Button } from '@cherryplay/components';

interface AdminPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

type PageItem = number | `ellipsis-${number}`;

const getPageItems = (page: number, totalPages: number): PageItem[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const visiblePages = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...visiblePages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
  const result: PageItem[] = [];

  pages.forEach((value, index) => {
    if (index > 0) {
      const previous = pages[index - 1];
      if (previous !== undefined && value - previous > 1) {
        result.push(value - previous === 2 ? previous + 1 : `ellipsis-${previous}`);
      }
    }
    result.push(value);
  });

  return result;
};

export const AdminPagination = ({
  page,
  total,
  pageSize,
  disabled = false,
  onPageChange,
}: AdminPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav className="admin-pagination" aria-label="Страницы списка">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => onPageChange(1)}
        disabled={page <= 1 || disabled}
        aria-label="Первая страница"
      >
        «
      </Button>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1 || disabled}
        aria-label="Предыдущая страница"
      >
        ←
      </Button>
      {getPageItems(page, totalPages).map((item) =>
        typeof item === 'number' ? (
          <Button
            key={item}
            variant={item === page ? 'primary' : 'secondary'}
            size="sm"
            type="button"
            onClick={() => onPageChange(item)}
            disabled={disabled}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </Button>
        ) : (
          <span key={item} aria-hidden="true" className="admin-pagination__ellipsis">
            …
          </span>
        ),
      )}
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages || disabled}
        aria-label="Следующая страница"
      >
        →
      </Button>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={page >= totalPages || disabled}
        aria-label="Последняя страница"
      >
        »
      </Button>
      <span aria-live="polite">
        Страница {page} из {totalPages}
      </span>
    </nav>
  );
};
