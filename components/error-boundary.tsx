"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("3D Viewer Error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center h-full text-red-400 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">3D Viewer Error</h2>
            <p className="text-sm text-center mb-4">
              There was an error loading the 3D viewer. This might be due to browser compatibility issues.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            {this.state.error && (
              <details className="mt-4 text-xs">
                <summary>Error Details</summary>
                <pre className="mt-2 p-2 bg-gray-900 rounded text-red-300">{this.state.error.message}</pre>
              </details>
            )}
          </div>
        )
      )
    }

    return this.props.children
  }
}
