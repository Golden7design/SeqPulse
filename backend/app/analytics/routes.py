from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.lifecycle_kpi import compute_lifecycle_kpis, compute_window_bounds
from app.db.deps import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/kpi/lifecycle")
def lifecycle_kpis(
    window_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    window_start, window_end, normalized_days = compute_window_bounds(window_days=window_days)
    kpis = compute_lifecycle_kpis(
        db=db,
        window_start=window_start,
        window_end=window_end,
    )
    return {
        "window": {
            "from": window_start.isoformat(),
            "to": window_end.isoformat(),
            "days": normalized_days,
            "computed_at": datetime.utcnow().isoformat() + "Z",
        },
        "kpis": kpis,
    }
