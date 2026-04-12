from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.routers import auth, queue, refine, spotify, suggestions

app = FastAPI(title="Live Shuffle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/auth")
app.include_router(spotify.router, prefix="/api")
app.include_router(queue.router, prefix="/api/queue")
app.include_router(refine.router, prefix="/api/refine")
app.include_router(suggestions.router, prefix="/api/suggestions")
