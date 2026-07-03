import { Loader2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { CompetitorsInput } from "@/components/CompetitorsInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function CreateProfile() {
  const create = useCreateProfile()
  const {
    register, handleSubmit, control, formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: "", domain: "", industry: "", description: "", competitors: [] },
  })

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Register a business profile</CardTitle>
          <CardDescription>
            The pipeline discovers what people ask AI assistants in this space and whether
            this domain shows up in the answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={handleSubmit(values => create.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                placeholder="Frase"
                {...register("name", {
                  required: "Name is required",
                  maxLength: { value: 255, message: "At most 255 characters" },
                })}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="frase.io"
                {...register("domain", {
                  required: "Domain is required",
                  pattern: {
                    value: /^[a-z0-9.-]+\.[a-z]{2,}$/i,
                    message: "Enter a bare domain like example.com",
                  },
                })}
              />
              {errors.domain && <p className="text-sm text-destructive">{errors.domain.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="SEO Content Tools"
                {...register("industry", {
                  required: "Industry is required",
                  maxLength: { value: 255, message: "At most 255 characters" },
                })}
              />
              {errors.industry && <p className="text-sm text-destructive">{errors.industry.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="AI-powered content briefs"
                {...register("description", {
                  maxLength: { value: 2000, message: "At most 2000 characters" },
                })}
              />
              <p className="text-xs text-muted-foreground">Optional — helps the discovery agent.</p>
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Competitors</Label>
              <Controller
                control={control}
                name="competitors"
                rules={{ validate: v => v.length <= 10 || "At most 10 competitors" }}
                render={({ field }) => (
                  <CompetitorsInput value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.competitors && <p className="text-sm text-destructive">{errors.competitors.message}</p>}
            </div>
            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Create profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
