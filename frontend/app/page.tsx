"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/FileUpload"
import { AnkiUpload } from "@/components/AnkiUpload"
import { VocabTable } from "@/components/VocabTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Trash2 } from "lucide-react"

interface VocabItem {
  word: string
  frequency: number
  context: string
}

export default function Home() {
  const [view, setView] = useState<"vocab" | "known">("vocab")
  const [vocabData, setVocabData] = useState<VocabItem[]>([])
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [knownWords, setKnownWords] = useState<string[]>([])
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

  const handleGenerateKnownDeck = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/generate-anki-known')
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to generate Anki deck from known words')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Known_Words.apkg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate Anki deck from known words')
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
      // Refresh known words list if user switches views later
      setKnownWords((prev) => [...prev, ...words])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to mark words as known')
    }
  }, [])

  const fetchKnownWords = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/known-words')
      if (!response.ok) {
        throw new Error('Failed to load known words')
      }
      const data = await response.json()
      setKnownWords(data.known_words ?? [])
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load known words')
    }
  }, [])

  const handleAnkiUploadSuccess = useCallback((data: { words_imported: number; total_known_words: number; sample_words: string[] }) => {
    setError(null)
    fetchKnownWords()
    // Show success message (you could add a toast notification here)
    alert(`Successfully imported ${data.words_imported} words! Total known words: ${data.total_known_words}`)
  }, [fetchKnownWords])

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
      setKnownWords([])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset known words')
    }
  }, [])

  useEffect(() => {
    if (view === "known") {
      fetchKnownWords()
    }
  }, [view, fetchKnownWords])

  const knownCount = useMemo(() => knownWords.length, [knownWords])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Japanese Vocabulary Analyzer</h1>
        <Tabs
          value={view}
          onValueChange={(val: "vocab" | "known") => setView(val)}
          className="w-full max-w-sm"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vocab">EPUB Vocabulary</TabsTrigger>
            <TabsTrigger value="known">Known Words</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "vocab" && (
        <>
          <FileUpload onUploadSuccess={handleUploadSuccess} onUploadError={handleUploadError} />

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {vocabData.length > 0 && (
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Vocabulary List ({vocabData.length} words)</CardTitle>
                  <CardDescription>
                    Review and mark words as known. Selected words will be filtered from future analyses.
                  </CardDescription>
                </div>
                <Button onClick={handleGenerateAnki}>
                  <Download className="mr-2 h-4 w-4" />
                  Generate Anki Deck
                </Button>
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
        </>
      )}

      {view === "known" && (
        <>
          <AnkiUpload onUploadSuccess={handleAnkiUploadSuccess} onUploadError={handleAnkiUploadError} />

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Known Words ({knownCount})</CardTitle>
                <CardDescription>Imported from Anki or marked as known.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleResetKnownWords}
                  variant="destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Reset Known Words
                </Button>
                <Button onClick={handleGenerateKnownDeck}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Known Words Deck
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {knownWords.length === 0 ? (
                <p className="text-muted-foreground">No known words yet. Import an Anki text file to get started.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {knownWords.map((word) => (
                    <div key={word} className="rounded-md border p-2 text-sm">
                      {word}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
