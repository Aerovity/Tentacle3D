"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Loader2, UploadCloud, CheckCircle, XCircle } from "lucide-react"

interface ImageUploadFormProps {
  onConvert: (
    file: File,
    options: { model_version: string; style: string; texture_resolution: number; remesh: string },
  ) => void
  previewImageUrl: string | null
  isLoading: boolean
  progress: number | null
  taskStatus: string | null
  error: string | null
}

export function ImageUploadForm({
  onConvert,
  previewImageUrl,
  isLoading,
  progress,
  taskStatus,
  error,
}: ImageUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modelVersion, setModelVersion] = useState<string>("v2.0-20240919")
  const [style, setStyle] = useState<string>("realistic")
  const [textureResolution, setTextureResolution] = useState<number>(1024)
  const [remesh, setRemesh] = useState<string>("none")

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
    } else {
      setSelectedFile(null)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (selectedFile) {
      onConvert(selectedFile, {
        model_version: modelVersion,
        style: style === "none" ? "" : style,
        texture_resolution: textureResolution,
        remesh,
      })
    }
  }

  return (
    <Card className="w-full max-w-md bg-gray-900 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl">Generate 3D Models</CardTitle>
        <CardDescription className="text-gray-400">Upload a 2D image to convert it into a 3D model.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="picture" className="text-gray-300">
              Upload Image
            </Label>
            <Input
              id="picture"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="file:text-white file:bg-gray-700 file:border-none file:rounded-md file:px-4 file:py-2 file:mr-4 hover:file:bg-gray-600 text-gray-300 border-gray-700 bg-gray-800"
              disabled={isLoading}
            />
            {selectedFile && <p className="text-sm text-gray-400 mt-2">Selected: {selectedFile.name}</p>}
          </div>

          {previewImageUrl && (
            <div className="relative w-full h-48 bg-gray-800 rounded-md overflow-hidden flex items-center justify-center">
              <Image
                src={previewImageUrl || "/placeholder.svg"}
                alt="Image Preview"
                fill
                style={{ objectFit: "contain" }}
                className="rounded-md"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="model-version" className="text-gray-300">
                Model Version
              </Label>
              <Input
                id="model-version"
                type="text"
                value={modelVersion}
                onChange={(e) => setModelVersion(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={isLoading}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="style" className="text-gray-300">
                Style
              </Label>
              <Select value={style} onValueChange={setStyle} disabled={isLoading}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="realistic">Realistic</SelectItem>
                  <SelectItem value="cartoon">Cartoon</SelectItem>
                  <SelectItem value="sculpture">Sculpture</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="texture-resolution" className="text-gray-300">
                Texture Resolution
              </Label>
              <Select
                value={textureResolution.toString()}
                onValueChange={(value) => setTextureResolution(Number(value))}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="512">512</SelectItem>
                  <SelectItem value="1024">1024</SelectItem>
                  <SelectItem value="2048">2048</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="remesh" className="text-gray-300">
                Remesh
              </Label>
              <Select value={remesh} onValueChange={setRemesh} disabled={isLoading}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select remesh option" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="quad">Quad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-md flex items-center justify-center"
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </form>

        {taskStatus && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-400">Status: {taskStatus}</p>
            {progress !== null && progress >= 0 && (
              <Progress value={progress} className="w-full bg-gray-700 [&>*]:bg-yellow-500" />
            )}
            {taskStatus === "success" && (
              <p className="text-green-500 flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" /> Conversion successful!
              </p>
            )}
            {taskStatus === "failed" && (
              <p className="text-red-500 flex items-center">
                <XCircle className="mr-2 h-4 w-4" /> Conversion failed.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-4">Error: {error}</p>}
      </CardContent>
    </Card>
  )
}
