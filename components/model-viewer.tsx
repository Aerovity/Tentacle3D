"use client"

import { useState, useEffect } from "react"
import { Loader2, Download, RotateCw } from "lucide-react"

interface ModelViewerProps {
  modelUrl: string | null
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [localModelPath, setLocalModelPath] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (modelUrl && isClient) {
      downloadAndSaveModel(modelUrl)
    }
  }, [modelUrl, isClient])

  const downloadAndSaveModel = async (url: string) => {
    setIsDownloading(true)
    setError(null)
    setDownloadProgress(0)

    try {
      console.log("Starting model download and save from:", url)

      // Extract task ID from the URL to create the model filename
      const urlParts = url.split("/")
      const taskIdIndex = urlParts.findIndex((part) => part === "task") + 1
      const taskId = urlParts[taskIdIndex]
      const format = new URLSearchParams(url.split("?")[1] || "").get("format") || "glb"
      const filename = `${taskId}.${format}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/octet-stream, model/gltf-binary, */*",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.status} ${response.statusText}`)
      }

      const contentLength = response.headers.get("content-length")
      const total = contentLength ? Number.parseInt(contentLength, 10) : 0

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to get response reader")
      }

      const chunks: Uint8Array[] = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        receivedLength += value.length

        if (total > 0) {
          setDownloadProgress(Math.round((receivedLength / total) * 100))
        }
      }

      console.log("Model downloaded successfully, size:", receivedLength, "bytes")

      // Set the model path to load from the backend's /models endpoint
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const modelPath = `${backendUrl}/models/${filename}`
      setLocalModelPath(modelPath)
      setIsDownloading(false)
    } catch (err: any) {
      console.error("Error downloading model:", err)
      setError(`Failed to download model: ${err.message}`)
      setIsDownloading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
        <div className="text-white">Initializing 3D Viewer...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg text-red-400 p-4">
        <p className="text-center mb-2">Error loading 3D model:</p>
        <p className="text-sm text-center mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null)
            if (modelUrl) {
              downloadAndSaveModel(modelUrl)
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry Download
        </button>
      </div>
    )
  }

  if (isDownloading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg text-white p-4">
        <Download className="h-8 w-8 mb-4" />
        <p className="mb-2">Downloading & Saving 3D Model...</p>
        <div className="w-full max-w-xs bg-gray-700 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-400">{downloadProgress}%</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {localModelPath ? (
        <ThreeViewer modelUrl={localModelPath} />
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

// Three.js viewer component with 360-degree rotation
function ThreeViewer({ modelUrl }: { modelUrl: string }) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(true)
  const [rotationSpeed, setRotationSpeed] = useState(0.01)

  useEffect(() => {
    let mounted = true
    let scene: any = null
    let renderer: any = null
    let camera: any = null
    let controls: any = null
    let animationId: number | null = null
    let model: any = null

    const initThreeJS = async () => {
      try {
        // Dynamic import of Three.js to avoid SSR issues
        const THREE = await import("three")
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")

        if (!mounted) return

        const container = document.getElementById("three-container")
        if (!container) return

        // Scene setup
        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1f2937)

        // Camera setup
        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000)
        camera.position.set(0, 0, 5)

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(container.clientWidth, container.clientHeight)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1
        container.appendChild(renderer.domElement)

        // Controls
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.minDistance = 1
        controls.maxDistance = 20
        controls.autoRotate = isRotating
        controls.autoRotateSpeed = 2.0

        // Enhanced lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.position.set(10, 10, 5)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        directionalLight.shadow.camera.near = 0.1
        directionalLight.shadow.camera.far = 50
        directionalLight.shadow.camera.left = -10
        directionalLight.shadow.camera.right = 10
        directionalLight.shadow.camera.top = 10
        directionalLight.shadow.camera.bottom = -10
        scene.add(directionalLight)

        // Additional lights for better illumination
        const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 100)
        pointLight1.position.set(-10, -10, -10)
        scene.add(pointLight1)

        const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 100)
        pointLight2.position.set(10, -10, 10)
        scene.add(pointLight2)

        const spotLight = new THREE.SpotLight(0xffffff, 0.8)
        spotLight.position.set(0, 20, 0)
        spotLight.angle = Math.PI / 6
        spotLight.penumbra = 0.1
        spotLight.decay = 2
        spotLight.distance = 200
        spotLight.castShadow = true
        scene.add(spotLight)

        // Load model
        const loader = new GLTFLoader()

        console.log("Loading model from:", modelUrl)

        loader.load(
          modelUrl,
          (gltf) => {
            if (!mounted) return

            model = gltf.scene

            // Calculate bounding box and center the model
            const box = new THREE.Box3().setFromObject(model)
            const center = box.getCenter(new THREE.Vector3())
            const size = box.getSize(new THREE.Vector3())

            // Center the model
            model.position.sub(center)

            // Scale model to fit in view
            const maxDim = Math.max(size.x, size.y, size.z)
            if (maxDim > 0) {
              const scale = Math.min(3 / maxDim, 5)
              model.scale.setScalar(scale)
            }

            // Enable shadows and improve materials
            model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true

                // Improve material properties
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat: any) => {
                      if (mat.isMeshStandardMaterial) {
                        mat.envMapIntensity = 1
                        mat.roughness = Math.min(mat.roughness, 0.8)
                        mat.metalness = Math.max(mat.metalness, 0.1)
                        mat.needsUpdate = true
                      }
                    })
                  } else if (child.material.isMeshStandardMaterial) {
                    child.material.envMapIntensity = 1
                    child.material.roughness = Math.min(child.material.roughness, 0.8)
                    child.material.metalness = Math.max(child.material.metalness, 0.1)
                    child.material.needsUpdate = true
                  }
                }
              }
            })

            scene.add(model)
            setIsLoading(false)

            console.log("Model loaded successfully")
            console.log("Model info:", {
              vertices: model.children.length,
              boundingBox: { size, center },
            })
          },
          (progress) => {
            console.log("Loading progress:", (progress.loaded / progress.total) * 100 + "%")
          },
          (error) => {
            console.error("Error loading model:", error)
            setError("Failed to load 3D model")
            setIsLoading(false)
          },
        )

        // Animation loop
        const animate = () => {
          if (!mounted) return

          animationId = requestAnimationFrame(animate)

          // Update controls auto-rotate
          controls.autoRotate = isRotating
          controls.update()

          renderer.render(scene, camera)
        }
        animate()

        // Handle resize
        const handleResize = () => {
          if (!mounted || !container) return

          camera.aspect = container.clientWidth / container.clientHeight
          camera.updateProjectionMatrix()
          renderer.setSize(container.clientWidth, container.clientHeight)
        }
        window.addEventListener("resize", handleResize)

        return () => {
          window.removeEventListener("resize", handleResize)
        }
      } catch (err) {
        console.error("Three.js initialization error:", err)
        setError("Failed to initialize 3D viewer")
        setIsLoading(false)
      }
    }

    initThreeJS()

    return () => {
      mounted = false
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      if (renderer) {
        const container = document.getElementById("three-container")
        if (container && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
        renderer.dispose()
      }
      if (controls) {
        controls.dispose()
      }
    }
  }, [modelUrl, isRotating])

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-4">
        <p className="text-center mb-2">Error loading 3D model:</p>
        <p className="text-sm text-center mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null)
            setIsLoading(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Enhanced Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`p-2 rounded-lg transition-colors ${
            isRotating ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title={isRotating ? "Stop 360° rotation" : "Start 360° rotation"}
        >
          <RotateCw className="h-4 w-4" />
        </button>

        {/* Rotation speed control */}
        {isRotating && (
          <div className="bg-gray-800 p-2 rounded-lg">
            <label className="text-xs text-gray-300 block mb-1">Speed</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={rotationSpeed * 100}
              onChange={(e) => setRotationSpeed(Number(e.target.value) / 100)}
              className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Model info */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-800 bg-opacity-75 p-2 rounded-lg text-xs text-gray-300">
        <p>🖱️ Click & drag to rotate</p>
        <p>🔍 Scroll to zoom</p>
        <p>📱 Touch & drag on mobile</p>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10">
          <div className="flex flex-col items-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>Loading 3D model...</p>
          </div>
        </div>
      )}

      {/* Three.js container */}
      <div id="three-container" className="w-full h-full" />
    </div>
  )
}
