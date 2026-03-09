# =============================================================================
# CloudMind AI – app.py
# FastAPI backend server
#
# Exposes:
#   POST /predict  — accepts telemetry JSON, returns ML prediction + scaling
#   GET  /health   — health check endpoint
#   GET  /         — welcome message
#
# Run with:
#   uvicorn app:app --reload --host 0.0.0.0 --port 8000
# =============================================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Import our prediction logic from predict.py
from predict import run_prediction

# ── Create FastAPI app ────────────────────────────────────────────────────────
app = FastAPI(
    title       = "CloudMind AI – Workload Prediction API",
    description = "Predicts future cloud workload and recommends server scaling actions.",
    version     = "1.0.0",
)

# ── Allow Streamlit frontend to call this API without CORS errors ─────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],   # In production, replace * with your frontend URL
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)


# =============================================================================
# REQUEST & RESPONSE MODELS
# Pydantic automatically validates incoming JSON and returns clear errors
# if required fields are missing or have wrong types.
# =============================================================================

class TelemetryInput(BaseModel):
    """
    Input schema — the telemetry values sent by the user or monitoring system.
    All fields have sensible defaults so the dashboard works out of the box.
    """
    requests_per_minute  : float = Field(...,  ge=0,    description="Current requests per minute")
    cpu_usage_percent    : float = Field(...,  ge=0,    le=100, description="CPU usage 0–100%")
    memory_usage_percent : float = Field(...,  ge=0,    le=100, description="Memory usage 0–100%")
    active_servers       : int   = Field(...,  ge=1,    description="Number of currently active servers")
    hour                 : int   = Field(...,  ge=0,    le=23,  description="Current hour (0–23)")
    minute               : int   = Field(...,  ge=0,    le=59,  description="Current minute (0–59)")

    # Optional fields — defaults are used if not provided
    response_time_ms     : float = Field(100,  ge=0,    description="Average response time in ms")
    cost_per_server      : float = Field(50.0, ge=0,    description="Cost per server per hour ($)")

    class Config:
        # Show example values in the auto-generated API docs at /docs
        json_schema_extra = {
            "example": {
                "requests_per_minute" : 850,
                "cpu_usage_percent"   : 70,
                "memory_usage_percent": 65,
                "active_servers"      : 4,
                "hour"                : 14,
                "minute"              : 30,
                "response_time_ms"    : 120,
                "cost_per_server"     : 50,
            }
        }


class PredictionOutput(BaseModel):
    """
    Output schema — what the API returns after prediction + decision engine.
    """
    predicted_requests  : float  # ML model prediction (req/min in 5 minutes)
    recommended_servers : int    # How many servers the system recommends
    action              : str    # "SCALE UP", "SCALE DOWN", or "KEEP SAME"
    load_per_server     : float  # Predicted load per server (req/min per server)


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
def root():
    """Welcome message — confirms the API is running."""
    return {
        "message": "[CloudMind AI] API is running.",
        "docs"   : "Visit /docs for the interactive API documentation.",
    }


@app.get("/health")
def health_check():
    """Health check endpoint — used by monitoring systems and the frontend."""
    return {"status": "healthy", "service": "CloudMind AI Prediction API"}


@app.post("/predict", response_model=PredictionOutput)
def predict(telemetry: TelemetryInput):
    """
    Main prediction endpoint.

    Accepts current cloud telemetry and returns:
    - predicted_requests  : workload forecast 5 minutes ahead
    - recommended_servers : how many servers to run
    - action              : SCALE UP / SCALE DOWN / KEEP SAME
    - load_per_server     : predicted load distributed across recommended servers
    """
    try:
        # Convert Pydantic model to plain dict for predict.py
        input_data = telemetry.model_dump()

        # Run ML prediction + decision engine
        result = run_prediction(input_data)

        return result

    except Exception as e:
        # Return a clear error message if something goes wrong
        raise HTTPException(
            status_code = 500,
            detail      = f"Prediction failed: {str(e)}"
        )


# =============================================================================
# RUN SERVER (only when running this file directly, not via uvicorn command)
# =============================================================================
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)