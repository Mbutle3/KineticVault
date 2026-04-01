from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import files, ai

app = FastAPI(title="Kinetic Vault API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/")
def root():
    return {"message": "Kinetic Vault API is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
