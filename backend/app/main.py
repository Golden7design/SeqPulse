from fastapi import FastAPI

app = FastAPI(
    title="SeqPulse API",
    version="0.1.0",
    description="Backend API for SeqPulse MVP"
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "seqpulse-backend"
    }
