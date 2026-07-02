import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ScoreBar } from "./ScoreBar"

describe("ScoreBar", () => {
  it("renders the numeric score and a proportional bar", () => {
    render(<ScoreBar score={0.73} />)
    expect(screen.getByText("0.73")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.73")
  })
  it("clamps out-of-range scores", () => {
    render(<ScoreBar score={1.4} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
  })
})
