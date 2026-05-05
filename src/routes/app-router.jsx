import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/features/auth/auth-context'
import { NotificationsProvider } from '@/features/notifications/notifications-context'
import { LoginPage } from '@/features/auth/pages/login-page'
import { SignupPage } from '@/features/auth/pages/signup-page'
import { AppLayout } from '@/layouts/app-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { ActivityPage } from '@/pages/activity-page'
import { ConnectionsPage } from '@/pages/connections-page'
import { ExplorePage } from '@/pages/explore-page'
import { HomePage } from '@/pages/home-page'
import { MyResearchPage } from '@/pages/my-research-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { PeoplePage } from '@/pages/people-page'
import { PostDetailPage } from '@/pages/post-detail-page'
import { ProfilePage } from '@/pages/profile-page'
import { QuestionDetailPage } from '@/pages/question-detail-page'
import { QuestionsPage } from '@/pages/questions-page'
import { ReelsPage } from '@/pages/reels-page'
import { ResearchDetailPage } from '@/pages/research-detail-page'
import { ResearchPage } from '@/pages/research-page'
import { SavedPage } from '@/pages/saved-page'
import { SearchPage } from '@/pages/search-page'
import { SettingsPage } from '@/pages/settings-page'
import { GuestOnly, RequireAuth } from '@/routes/route-guards'
import { ToastProvider } from '@/components/ui/toaster'
import { NotificationBridge } from '@/components/app/notification-bridge'

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <ToastProvider>
            <NotificationBridge />
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/reels" element={<ReelsPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/research/:idOrSlug" element={<ResearchDetailPage />} />
                <Route path="/questions" element={<QuestionsPage />} />
                <Route path="/questions/:questionId" element={<QuestionDetailPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/posts/:postId" element={<PostDetailPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route
                  path="/profile/:username/followers"
                  element={<ConnectionsPage initialTab="followers" />}
                />
                <Route
                  path="/profile/:username/following"
                  element={<ConnectionsPage initialTab="following" />}
                />

                <Route element={<RequireAuth />}>
                  <Route path="/saved" element={<SavedPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/my-research" element={<MyResearchPage />} />
                </Route>
              </Route>

              <Route element={<AuthLayout />}>
                <Route element={<GuestOnly />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ToastProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
