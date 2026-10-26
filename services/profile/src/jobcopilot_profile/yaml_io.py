import yaml
from pydantic import ValidationError

from jobcopilot_profile.schemas import Profile

HEADER = (
    "# Profil job-copilot. Modifiable à la main, puis réimportable dans l'application.\n"
    "# Les dates d'expérience sont au format AAAA-MM.\n"
)


class ProfileFileError(ValueError):
    """Le fichier n'est pas un YAML valide ou ne respecte pas le format du profil."""

    def __init__(self, message: str, errors: list[dict] | None = None):
        super().__init__(message)
        self.errors = errors or []


def dump_profile(profile: Profile) -> str:
    data = profile.model_dump(mode="json", exclude_none=True)
    return HEADER + yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=100)


def load_profile(text: str) -> Profile:
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ProfileFileError("Le fichier n'est pas un YAML valide.") from exc
    if not isinstance(data, dict):
        raise ProfileFileError("Le fichier doit décrire un profil (identity, search, ...).")
    try:
        return Profile.model_validate(data)
    except ValidationError as exc:
        errors = [
            {"loc": ".".join(str(part) for part in error["loc"]), "msg": error["msg"]}
            for error in exc.errors()
        ]
        raise ProfileFileError("Le profil contient des champs invalides.", errors) from exc
