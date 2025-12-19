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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter words..."
          value={(table.getColumn("word")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("word")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        {selectedWords.size > 0 && (
          <Button onClick={handleMarkSelectedAsKnown} variant="secondary">
            Mark {selectedWords.size} as Known
          </Button>
        )}
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
      <div className="flex items-center justify-end space-x-2">
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
      </div>
    </div>
  )
}

