import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { configError } from './lib/supabase'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => count < 2 && (error as { code?: string })?.code !== '42501',
      refetchOnWindowFocus: false,
    },
  },
})

const root = createRoot(document.getElementById('root')!)

if (configError) {
  root.render(
    <div className="center-page">
      <div className="alert alert-error">{configError}</div>
    </div>,
  )
} else {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
