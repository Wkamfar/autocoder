import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'white'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check sessionStorage first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('pose-theme')
      if (saved === 'white' || saved === 'dark') {
        return saved as Theme
      }
      // Default to white mode for homepage and protocol page
      const pathname = window.location.pathname
      if (pathname === '/' || pathname === '/model' || pathname === '/protocol') {
        return 'white'
      }
    }
    return 'dark'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pose-theme', theme)
      // Apply theme class to body for global styles
      if (theme === 'white') {
        document.body.classList.add('pose-white-mode')
        document.documentElement.classList.add('pose-white-mode')
      } else {
        document.body.classList.remove('pose-white-mode')
        document.documentElement.classList.remove('pose-white-mode')
      }
    }
  }, [theme])

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'white' : 'dark')
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

