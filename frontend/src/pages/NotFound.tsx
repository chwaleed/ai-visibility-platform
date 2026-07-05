import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-1.5 bg-linear-to-br from-[#7b5bff] to-[#5a2fe0] bg-clip-text text-[clamp(48px,14vw,88px)] leading-none font-bold tracking-[-0.04em] text-transparent">
        404
      </div>
      <h2 className="mb-2 text-[19px] font-semibold tracking-[-0.01em]">Page not found</h2>
      <p className="mb-5 max-w-[360px] text-[13.5px] text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved. Check the link or head
        back to your profiles.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Button render={<Link to="/" />}>Back to profiles</Button>
        <Button variant="outline" render={<Link to="/profiles/new" />}>New profile</Button>
      </div>
    </div>
  )
}
