"use client"

import { useMemo, useCallback, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface VocabItem {
  word: string
  frequency: number
  context: string
}

interface VocabTableProps {
  data: VocabItem[]
  selectedWords: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  onMarkAsKnown: (words: string[]) => void
}

export const VocabTable = ({
  data,
  selectedWords,
  onSelectionChange,
  onMarkAsKnown,
}: VocabTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo<ColumnDef<VocabItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value)
              const allWords = table.getRowModel().rows.map((row) => row.original.word)
              if (value) {
                onSelectionChange(new Set([...selectedWords, ...allWords]))
              } else {
                const newSet = new Set(selectedWords)
                allWords.forEach((word) => newSet.delete(word))
                onSelectionChange(newSet)
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedWords.has(row.original.word)}
            onCheckedChange={(value) => {
              const newSet = new Set(selectedWords)
              if (value) {
                newSet.add(row.original.word)
              } else {
                newSet.delete(row.original.word)
              }
              onSelectionChange(newSet)
            }}
          />
        ),
      },
      {
        accessorKey: "index",
        header: "#",
        cell: (info) => {
          const { pageIndex, pageSize } = info.table.getState().pagination
          const displayIndex = pageIndex * pageSize + info.row.index + 1
          return <div className="text-center text-sm text-muted-foreground">{displayIndex}</div>
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "word",
        header: "Word",
        cell: (info) => (
          <div className="font-medium text-lg">{info.getValue() as string}</div>
        ),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        cell: (info) => (
          <div className="text-center">{info.getValue() as number}</div>
        ),
      },
      {
        accessorKey: "context",
        header: "Context",
        cell: (info) => (
          <div className="max-w-md text-sm text-muted-foreground">
            {(info.getValue() as string).substring(0, 100)}
            {(info.getValue() as string).length > 100 ? "..." : ""}
          </div>
        ),
      },
    ],
    [selectedWords, onSelectionChange]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  const handleMarkSelectedAsKnown = useCallback(() => {
    if (selectedWords.size > 0) {
      onMarkAsKnown(Array.from(selectedWords))
    }
  }, [selectedWords, onMarkAsKnown])

  type PaginationItem =
    | { type: "page"; value: number }
    | { type: "ellipsis"; id: string }

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  const paginationItems = useMemo(() => {
    const current = pageIndex

    // Show all pages if small
    if (pageCount <= 9) {
      return Array.from({ length: pageCount }, (_, i) => ({ type: "page", value: i } satisfies PaginationItem))
    }

    // Include first/last and a wider window around current
    const windowPages = [
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2,
    ]

    const pages = new Set<number>([0, pageCount - 1, ...windowPages])
    const sorted = Array.from(pages)
      .filter((p) => p >= 0 && p < pageCount)
      .sort((a, b) => a - b)

    const items: PaginationItem[] = []
    sorted.forEach((page, index) => {
      items.push({ type: "page", value: page })
      const next = sorted[index + 1]
      if (next !== undefined && next - page > 1) {
        items.push({ type: "ellipsis", id: `${page}-${next}` })
      }
    })
    return items
  }, [pageCount, pageIndex])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter words..."
            value={(table.getColumn("word")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("word")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <div className="flex items-center gap-1">
            {paginationItems.map((item) =>
              item.type === "page" ? (
                <Button
                  key={item.value}
                  variant={table.getState().pagination.pageIndex === item.value ? "default" : "outline"}
                  size="sm"
                  className="w-10 justify-center"
                  onClick={() => table.setPageIndex(item.value)}
                >
                  {item.value + 1}
                </Button>
              ) : (
                <span key={item.id} className="px-2 text-muted-foreground">
                  ...
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
          {selectedWords.size > 0 && (
            <Button onClick={handleMarkSelectedAsKnown} variant="secondary">
              Mark {selectedWords.size} as Known
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

