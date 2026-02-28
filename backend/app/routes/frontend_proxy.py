from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

router = APIRouter(tags=["frontend_proxy"])

FRONTEND_ORIGIN = "http://localhost:3000"


async def _proxy(path: str, request: Request) -> Response:
    url = f"{FRONTEND_ORIGIN}/{path}"
    if request.query_params:
        url += f"?{request.query_params}"
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        resp = await client.get(url, headers={"host": "localhost:3000"})
    content_type = resp.headers.get("content-type", "text/html")
    return Response(content=resp.content, status_code=resp.status_code, media_type=content_type)


@router.get("/apply/{prospect_id}")
async def proxy_apply(prospect_id: str, request: Request):
    return await _proxy(f"apply/{prospect_id}", request)


@router.get("/sign/{token}")
async def proxy_sign(token: str, request: Request):
    return await _proxy(f"sign/{token}", request)


@router.get("/_next/{rest_of_path:path}")
async def proxy_next_assets(rest_of_path: str, request: Request):
    return await _proxy(f"_next/{rest_of_path}", request)
