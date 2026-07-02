import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EmptyState } from "./EmptyState"
import { ErrorState } from "./ErrorState"

describe("state components", () => {
  it("ErrorState shows message and fires retry", async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Boom" onRetry={onRetry} />)
    expect(screen.getByText("Boom")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
  it("EmptyState renders title and action", () => {
    render(<EmptyState title="No queries yet" action={<button>Run pipeline</button>} />)
    expect(screen.getByText("No queries yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /run pipeline/i })).toBeInTheDocument()
  })
})
