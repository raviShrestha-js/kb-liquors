import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Catches render-time errors anywhere below it and shows a recoverable screen
 *  instead of a blank white page. Local data is untouched, so a reload recovers. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught by boundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              ⚠️
            </div>
            <h2>Something went wrong</h2>
            <p>
              The app hit an unexpected error. Your data is saved locally and safe — reloading usually fixes
              it.
            </p>
            <button className="button-primary button-large" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
