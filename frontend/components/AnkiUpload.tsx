"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, BookOpen } from "lucide-react"

interface AnkiUploadProps {
  onUploadSuccess: (data: { words_imported: number; total_known_words: number; sample_words: string[] }) => void
  onUploadError: (error: string) => void
}

export const AnkiUpload = ({ onUploadSuccess, onUploadError }: AnkiUploadProps) => {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.txt')) {
      setSelectedFile(file)
    } else {
      onUploadError("Please select a valid Anki text export (.txt file)")
    }
  }, [onUploadError])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      onUploadError("Please select a file first")
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('http://localhost:8000/upload-anki', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const data = await response.json()
      onUploadSuccess(data)
      setSelectedFile(null)
      // Reset file input
      const fileInput = document.querySelector('input[type="file"][accept=".txt"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, onUploadSuccess, onUploadError])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Import Anki Text Export
        </CardTitle>
        <CardDescription>
          Upload an Anki text export (.txt) to import vocabulary words into your known words list
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            disabled={isUploading}
          />
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Importing..." : "Import Words"}
          </Button>
        </div>
        {selectedFile && (
          <p className="text-sm text-muted-foreground">
            Selected: {selectedFile.name}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

