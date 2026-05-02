import { TweaksProvider } from '@/features/tweaks/tweaks-context'
import { AppRouter } from '@/routes/app-router'

function App() {
  return (
    <TweaksProvider>
      <AppRouter />
    </TweaksProvider>
  )
}

export default App
