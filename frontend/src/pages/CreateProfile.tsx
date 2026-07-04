import { ChevronLeft, Loader2, TriangleAlert } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { Link } from "react-router"
import { CompetitorsInput } from "@/components/CompetitorsInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useCreateProfile } from "@/hooks/useCreateProfile"

// ponytail: native react-hook-form rules, not zod + a resolver bridge — 5 trivial
// field validations don't warrant a schema layer (and its zod-v4 peer type skew).
interface FormValues {
  name: string
  domain: string
  industry: string
  description: string
  competitors: string[]
}

const INDUSTRIES = [
  "Enterprise SaaS", "Developer Tools", "E-commerce", "Fintech",
  "Digital Health", "Marketing", "Cybersecurity", "Other",
]

const labelCls = "text-xs font-medium text-secondary-foreground"

export default function CreateProfile() {
  const create = useCreateProfile()
  const {
    register, handleSubmit, control, formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "", domain: "", industry: "Enterprise SaaS", description: "", competitors: [],
    },
  })
  const hasErrors = Object.keys(errors).length > 0

  return (
    <div>
      <Link
        to="/"
        className="mb-3.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to profiles
      </Link>
      <h1 className="text-[23px] font-semibold tracking-[-0.02em]">New Business Profile</h1>
      <p className="mb-5 text-[13.5px] text-muted-foreground">
        Register a business to discover how visible it is in AI answers.
      </p>

      <form
        className="max-w-[620px] rounded-2xl border border-border bg-card p-6"
        onSubmit={handleSubmit(values => create.mutate(values))}
      >
        {hasErrors && (
          <div className="mb-[18px] flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger">
            <TriangleAlert className="size-4 shrink-0" />
            Please fix the highlighted fields below.
          </div>
        )}

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className={labelCls}>Business name</Label>
            <Input
              id="name" placeholder="Acme Corp" aria-invalid={!!errors.name}
              {...register("name", {
                required: "Business name is required.",
                maxLength: { value: 255, message: "At most 255 characters" },
              })}
            />
            {errors.name && <p className="text-[11.5px] text-danger">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domain" className={labelCls}>Domain</Label>
            <Input
              id="domain" placeholder="acme.com" aria-invalid={!!errors.domain}
              {...register("domain", {
                required: "Domain is required.",
                pattern: {
                  value: /^[a-z0-9.-]+\.[a-z]{2,}$/i,
                  message: "Enter a valid domain, e.g. acme.com",
                },
              })}
            />
            {errors.domain && <p className="text-[11.5px] text-danger">{errors.domain.message}</p>}
          </div>
        </div>

        <div className="mb-4 space-y-1.5">
          <Label className={labelCls}>Industry</Label>
          <Controller
            control={control}
            name="industry"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="description" className={labelCls}>
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="description" rows={3} placeholder="What does this business do?"
            className="w-full resize-y rounded-[9px] border border-input bg-transparent px-3 py-2.5 text-[13px] outline-none focus-visible:border-ring"
            {...register("description", {
              maxLength: { value: 2000, message: "At most 2000 characters" },
            })}
          />
        </div>

        <div className="mb-[22px] space-y-1.5">
          <Label className={labelCls}>Competitors</Label>
          <Controller
            control={control}
            name="competitors"
            rules={{ validate: v => v.length <= 10 || "At most 10 competitors" }}
            render={({ field }) => (
              <CompetitorsInput value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.competitors && <p className="text-[11.5px] text-danger">{errors.competitors.message}</p>}
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create profile
          </Button>
          <Button type="button" variant="outline" render={<Link to="/" />}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
