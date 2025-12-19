"use client"

import { useState, useMemo, useCallback } from "react"
import { FileUpload } from "@/components/FileUpload"
import { AnkiUpload } from "@/components/AnkiUpload"
import { VocabTable } from "@/components/VocabTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Trash2 } from "lucide-react"

interface VocabItem {
  word: string
  frequency: number
  context: string
}

export default function Home() {
  const [vocabData, setVocabData] = useState<VocabItem[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleUploadSuccess = useCallback((data: { vocab: VocabItem[]; count: number }) => {
    setVocabData(data.vocab)
    setError(null)
  }, [])

  const handleUploadError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setVocabData([])
  }, [])

  const handleGenerateAnki = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/generate-anki')
      if (!response.ok) {
        throw new Error('Failed to generate Anki deck')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Japanese_Vocab.apkg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate Anki deck')
    }
  }, [])

  const handleMarkAsKnown = useCallback(async (words: string[]) => {
    try {
      const response = await fetch('http://localhost:8000/update-known', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          words,
          action: 'add',
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to update known words')
      }
      // Remove marked words from the current vocab list
      setVocabData(prev => prev.filter(item => !words.includes(item.word)))
      setSelectedWords(new Set())
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to mark words as known')
    }
  }, [])

  const handleAnkiUploadSuccess = useCallback((data: { words_imported: number; total_known_words: number; sample_words: string[] }) => {
    setError(null)
    // Show success message (you could add a toast notification here)
    alert(`Successfully imported ${data.words_imported} words! Total known words: ${data.total_known_words}`)
  }, [])

  const handleAnkiUploadError = useCallback((errorMessage: string) => {
    setError(errorMessage)
  }, [])

  const handleResetKnownWords = useCallback(async () => {
    if (!confirm('Are you sure you want to reset all known words? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('http://localhost:8000/reset-known-words', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to reset known words')
      }
      alert('All known words have been cleared successfully!')
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset known words')
    }
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Japanese Vocabulary Analyzer</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleResetKnownWords}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Reset Known Words
          </Button>
          {vocabData.length > 0 && (
            <Button onClick={handleGenerateAnki}>
              <Download className="mr-2 h-4 w-4" />
              Generate Anki Deck
            </Button>
          )}
        </div>
      </div>

      <FileUpload onUploadSuccess={handleUploadSuccess} onUploadError={handleUploadError} />
      <AnkiUpload onUploadSuccess={handleAnkiUploadSuccess} onUploadError={handleAnkiUploadError} />

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {vocabData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vocabulary List ({vocabData.length} words)</CardTitle>
            <CardDescription>
              Review and mark words as known. Selected words will be filtered from future analyses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VocabTable
              data={vocabData}
              selectedWords={selectedWords}
              onSelectionChange={setSelectedWords}
              onMarkAsKnown={handleMarkAsKnown}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
