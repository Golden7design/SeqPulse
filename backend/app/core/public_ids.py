from uuid import UUID


def format_project_public_id(project_number: int) -> str:
    return f"prj_{project_number}"


def format_deployment_public_id(deployment_number: int) -> str:
    return f"dpl_{deployment_number}"


def parse_project_identifier(value: str) -> tuple[str, int | UUID]:
    return _parse_identifier(value=value, prefix="prj_")


def parse_deployment_identifier(value: str) -> tuple[str, int | UUID]:
    return _parse_identifier(value=value, prefix="dpl_")


def _parse_identifier(value: str, prefix: str) -> tuple[str, int | UUID]:
    raw = value.strip()
    if raw.startswith(prefix):
        suffix = raw[len(prefix):]
        if not suffix.isdigit():
            raise ValueError("invalid public identifier format")
        number = int(suffix)
        if number <= 0:
            raise ValueError("identifier number must be positive")
        return ("number", number)

    try:
        return ("uuid", UUID(raw))
    except ValueError as exc:
        raise ValueError("invalid identifier format") from exc
