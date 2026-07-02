from pydantic import BaseModel, Field, field_validator


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    domain: str = Field(min_length=3, max_length=255)
    industry: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    competitors: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, v: str) -> str:
        v = v.strip().lower().removeprefix("https://").removeprefix("http://")
        v = v.removeprefix("www.").rstrip("/")
        if "." not in v:
            raise ValueError("domain must look like 'example.com'")
        return v

    @field_validator("competitors")
    @classmethod
    def normalize_competitors(cls, v: list[str]) -> list[str]:
        return [c.strip().lower().removeprefix("https://").removeprefix("http://")
                .removeprefix("www.").rstrip("/") for c in v if c.strip()]
