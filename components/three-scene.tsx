"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, useGLTF, Html } from "@react-three/drei"
import { Suspense, useRef, useEffect, useState } from "react"
import * as THREE from "three"
import { Loader2 } from "lucide-react"

interface GLBModelProps {
  url: string
}

function GLBModel({ url }: GLBModelProps) {
  const { scene, error } = useGLTF(url, true)
  const [modelError, setModelError] = useState<string | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (error) {
      setModelError("Failed to load 3D model")
      console.error("GLTF loading error:", error)
      return
    }

    if (scene && groupRef.current) {
      try {
        // Clear any existing children
        groupRef.current.clear()

        // Clone the scene to avoid issues with multiple instances
        const clonedScene = scene.clone()

        // Calculate bounding box for proper scaling and centering
        const box = new THREE.Box3().setFromObject(clonedScene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        // Center the model
        clonedScene.position.sub(center)

        // Scale the model to fit nicely in view (max dimension = 2 units)
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) {
          const scale = Math.min(2 / maxDim, 3) // Cap at 3x scale
          clonedScene.scale.setScalar(scale)
        }

        // Add the cloned scene to our group
        groupRef.current.add(clonedScene)

        // Ensure materials are properly set up
        clonedScene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true

            // Ensure material is properly configured
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  if (mat instanceof THREE.MeshStandardMaterial) {
                    mat.needsUpdate = true
                  }
                })
              } else if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.needsUpdate = true
              }
            }
          }
        })

        setModelError(null)
      } catch (err) {
        console.error("Error processing 3D model:", err)
        setModelError("Error processing 3D model")
      }
    }
  }, [scene, error])

  if (modelError) {
    return (
      <Html center>
        <div className="text-red-400 text-center p-4 bg-gray-800 rounded">
          <p>{modelError}</p>
        </div>
      </Html>
    )
  }

  return <group ref={groupRef} />
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center text-white bg-gray-800 p-4 rounded">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>Loading 3D Model...</p>
      </div>
    </Html>
  )
}

// Simplified Center component to avoid dependency issues
function SimpleCenter({ children }: { children: React.ReactNode }) {
  return (
    <group position={[0, 0, 0]}>
      {children}
    </group>
  )
}

interface ThreeSceneProps {
  modelUrl: string | null
}

export function ThreeScene({ modelUrl }: ThreeSceneProps) {
  const [isClient, setIsClient] = useState(false)
  const [sceneError, setSceneError] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <div className="text-white">Initializing 3D Viewer...</div>
      </div>
    )
  }

  if (sceneError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <div className="text-red-400 text-center">
          <p>3D Viewer Error</p>
          <p className="text-sm mt-2">{sceneError}</p>
          <button
            onClick={() => setSceneError(null)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x1f2937, 1) // Gray-800 background
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          scene.fog = new THREE.Fog(0x1f2937, 10, 50)
        }}
        onError={(error) => {
          console.error("Canvas error:", error)
          setSceneError("Failed to initialize 3D canvas")
        }}
      >
        {/* Lighting setup */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        <spotLight position={[0, 10, 0]} angle={0.3} penumbra={1} intensity={0.5} castShadow />

        <Suspense fallback={<LoadingFallback />}>
          {modelUrl && (
            <SimpleCenter>
              <GLBModel url={modelUrl} />
            </SimpleCenter>
          )}

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1}
            maxDistance={20}
            maxPolarAngle={Math.PI}
            enableDamping={true}
            dampingFactor={0.05}
          />

          <Environment preset="city" background={false} />
        </Suspense>

        {/* Ground plane for better visual reference */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#2a2a2a" transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
  )
}