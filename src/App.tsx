import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireSport } from './auth/guards'
import { Layout, MorePage } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { SportPickerPage } from './features/sport/SportPickerPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { PlayersPage } from './features/players/PlayersPage'
import { PlayerDetailPage } from './features/players/PlayerDetailPage'
import { TrainingsPage } from './features/trainings/TrainingsPage'
import { TrainingEditPage } from './features/trainings/TrainingForm'
import { MatchesPage } from './features/matches/MatchesPage'
import { MatchDetailPage } from './features/matches/MatchDetailPage'
import { AttendancePage } from './features/attendance/AttendancePage'
import { AttendanceHistoryPage } from './features/attendance/AttendanceHistoryPage'
import { ReviewsPage } from './features/reviews/ReviewsPage'
import { ReviewDetailPage } from './features/reviews/ReviewDetailPage'
import { CommitmentsPage } from './features/commitments/CommitmentsPage'
import { GuidePage } from './features/guide/GuidePage'
import { AdminPage } from './features/admin/AdminPage'
import { ProfilePage } from './features/profile/ProfilePage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/deporte"
          element={
            <RequireAuth>
              <SportPickerPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <RequireSport>
                <Layout />
              </RequireSport>
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="jugadores" element={<PlayersPage />} />
          <Route path="jugadores/:id" element={<PlayerDetailPage />} />
          <Route path="entrenamientos" element={<TrainingsPage />} />
          <Route path="entrenamientos/:id" element={<TrainingEditPage />} />
          <Route path="partidos" element={<MatchesPage />} />
          <Route path="partidos/:id" element={<MatchDetailPage />} />
          <Route path="asistencia" element={<AttendancePage />} />
          <Route path="asistencia/historial" element={<AttendanceHistoryPage />} />
          <Route path="revisiones" element={<ReviewsPage />} />
          <Route path="revisiones/:id" element={<ReviewDetailPage />} />
          <Route path="compromisos" element={<CommitmentsPage />} />
          <Route path="guia" element={<GuidePage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="mas" element={<MorePage />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route
            path="*"
            element={
              <div className="stack">
                <h1>Página no encontrada</h1>
                <Link to="/">Volver al inicio</Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
