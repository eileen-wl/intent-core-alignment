"""Registers Pydantic models that have no route yet into the generated
OpenAPI document's ``components/schemas`` section.

FastAPI only emits a model into ``components/schemas`` when at least one
route's request/response actually references it. Step 8C-2 needs the new
ftrack Version/ReviewNote sync contracts (``api.ftrack_version_note_sync``)
to reach ``packages/contracts/ts``'s generated TypeScript ahead of the
trusted internal sync endpoint that will use them (a later slice, not
this one) -- so they need to be in the OpenAPI document now, without a
route. This module is that registration point: the standard, documented
FastAPI extension point for exactly this case (customizing ``app.openapi``
via ``fastapi.openapi.utils.get_openapi``), not a private workaround, and
not a route, path, or operation of any kind. No request of any shape can
reach these models through this module.
"""

from __future__ import annotations

from collections.abc import Sequence

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel


def register_schema_only_models(app: FastAPI, models: Sequence[type[BaseModel]]) -> None:
    """Ensure each of ``models`` appears under ``components/schemas`` in
    ``app.openapi()``'s output, in addition to whatever routes already
    contribute. Idempotent: safe to call once at import time.
    """

    def _openapi_with_extra_schemas() -> dict[str, object]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        for model in models:
            model_schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
            # Nested/referenced models a top-level model depends on
            # (e.g. a Literal-backed sub-model) land in "$defs" --
            # promote each into components/schemas alongside the
            # top-level model, matching where the ref_template above
            # already points.
            for def_name, def_schema in model_schema.pop("$defs", {}).items():
                components.setdefault(def_name, def_schema)
            components[model.__name__] = model_schema
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = _openapi_with_extra_schemas  # type: ignore[method-assign]
