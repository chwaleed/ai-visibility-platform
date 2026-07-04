import { Route, Routes } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import CreateProfile from "@/pages/CreateProfile"
import Dashboard from "@/pages/Dashboard"
import NotFound from "@/pages/NotFound"
import ProfileDetail from "@/pages/ProfileDetail"

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profiles/new" element={<CreateProfile />} />
        <Route path="/profiles/:uuid" element={<ProfileDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
