"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Header } from "@/components/header"
import { ImageUploadForm } from "@/components/image-upload-form"
import { ErrorBoundary } from "@/components/error-boundary"

const ModelViewer = dynamic(() => import("@/components/model-viewer").then((mod) => mod.ModelViewer), { ssr: false })

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Effect to create and revoke preview URL
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewImageUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewImageUrl(null)
    }
  }, [selectedFile])

  // Effect to poll task status
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (taskId && (taskStatus === "queued" || taskStatus === "running")) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/task/${taskId}`)
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          const data = await response.json()
          setTaskStatus(data.status)
          setProgress(data.progress)

          if (data.status === "success") {
            clearInterval(intervalId)
            // Create download URL for GLB format with cache busting
            const downloadUrl = `${BACKEND_URL}/task/${taskId}/download?format=glb&t=${Date.now()}`
            setModelUrl(downloadUrl)
            setIsLoading(false)
          } else if (data.status === "failed") {
            clearInterval(intervalId)
            setError("Conversion failed. Please try again.")
            setIsLoading(false)
          }
        } catch (err: any) {
          clearInterval(intervalId)
          setError(`Failed to fetch task status: ${err.message}`)
          setIsLoading(false)
        }
      }, 5000) // Poll every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [taskId, taskStatus])

  const handleConvert = async (
    file: File,
    options: { model_version: string; style: string; texture_resolution: number; remesh: string },
  ) => {
    setSelectedFile(file)
    setIsLoading(true)
    setError(null)
    setTaskId(null)
    setTaskStatus(null)
    setProgress(null)
    setModelUrl(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("model_version", options.model_version)
    if (options.style) formData.append("style", options.style)
    formData.append("texture_resolution", options.texture_resolution.toString())
    formData.append("remesh", options.remesh)

    try {
      const response = await fetch(`${BACKEND_URL}/convert/image-to-3d`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setTaskId(data.task_id)
      setTaskStatus(data.status)
      // Polling will start via useEffect
    } catch (err: any) {
      setError(`Conversion initiation failed: ${err.message}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />
      <main className="flex flex-1 flex-col md:flex-row p-4 pt-20 space-y-4 md:space-y-0 md:space-x-4">
        <div className="w-full md:w-1/3 flex justify-center">
          <ImageUploadForm
            onConvert={handleConvert}
            previewImageUrl={previewImageUrl}
            isLoading={isLoading}
            progress={progress}
            taskStatus={taskStatus}
            error={error}
          />
        </div>
        <div className="w-full md:w-2/3 flex justify-center">
          <div className="w-full h-[600px]">
            <ErrorBoundary>
              <ModelViewer modelUrl={modelUrl} />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  )
}
