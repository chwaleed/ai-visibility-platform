import { Route, Routes, useParams } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import CreateProfile from "@/pages/CreateProfile"
import Dashboard from "@/pages/Dashboard"
import NotFound from "@/pages/NotFound"
import ProfileDetail from "@/pages/ProfileDetail"

// Param-only navigation (profile A → profile B) reuses the mounted element, so
// page state (active pipeline run, selected tab) would leak across profiles.
// Keying by uuid remounts the page with clean state per profile.
function ProfileDetailRoute() {
  const { uuid = "" } = useParams()
  return <ProfileDetail key={uuid} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profiles/new" element={<CreateProfile />} />
        <Route path="/profiles/:uuid" element={<ProfileDetailRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
