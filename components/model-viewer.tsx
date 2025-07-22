"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

// Dynamically import the ThreeScene component with SSR disabled
const ThreeScene = dynamic(() => import("./three-scene").then((mod) => mod.ThreeScene), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-lg bg-gray-800">
      <Loader2 className="h-8 w-8 animate-spin mb-2" />
      <p>Loading 3D Viewer...</p>
    </div>
  ),
})

interface ModelViewerProps {
  modelUrl: string | null
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModelLoading, setIsModelLoading] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (modelUrl) {
      setIsModelLoading(true)
      setError(null)

      // Test if the model URL is accessible
      fetch(modelUrl, { method: "HEAD" })
        .then((response) => {
          if (!response.ok) {
            setError(`Model not accessible: ${response.status} ${response.statusText}`)
          } else {
            setError(null)
          }
        })
        .catch((err) => {
          console.error("Model URL check failed:", err)
          setError(`Failed to access model: ${err.message}`)
        })
        .finally(() => {
          setIsModelLoading(false)
        })
    } else {
      setError(null)
      setIsModelLoading(false)
    }
  }, [modelUrl])

  if (!isClient) {
    return (
      <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-gray-400">Initializing 3D Viewer...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-red-400 text-lg p-4">
          <p className="text-center mb-2">Error loading 3D model:</p>
          <p className="text-sm text-center mb-4 text-red-300">{error}</p>
          <button
            onClick={() => {
              setError(null)
              if (modelUrl) {
                // Retry loading
                window.location.reload()
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : modelUrl ? (
        <div className="relative w-full h-full">
          {isModelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10">
              <div className="flex flex-col items-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Preparing 3D model...</p>
              </div>
            </div>
          )}
          <ThreeScene modelUrl={modelUrl} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 text-lg">
          <div className="text-center">
            <p className="mb-2">Upload an image and click "Generate" to see your 3D model here.</p>
            <p className="text-sm text-gray-500">Supported formats: GLB, GLTF</p>
          </div>
        </div>
      )}
    </div>
  )
}
