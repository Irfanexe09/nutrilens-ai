from datetime import date, datetime, time, timedelta
from typing import Tuple, Optional


def get_utc_bounds_for_local_date(
    target_date: date, tz_offset_minutes: int = 0
) -> Tuple[datetime, datetime]:
    """
    Given a local calendar date and client timezone offset in minutes
    (where tz_offset_minutes = (UTC - Local) in minutes, standard for JS Date.getTimezoneOffset()),
    returns the exact UTC datetime bounds [start_utc, end_utc] covering that 24-hour local day.
    
    Example:
    Local date: 2026-10-10, IST (UTC+5:30 -> tz_offset_minutes = -330)
    Local start: 2026-10-10 00:00:00 -> UTC start: 2026-10-09 18:30:00
    Local end: 2026-10-10 23:59:59.999999 -> UTC end: 2026-10-10 18:29:59.999999
    """
    local_start = datetime.combine(target_date, time.min)
    local_end = datetime.combine(target_date, time.max)
    start_utc = local_start + timedelta(minutes=tz_offset_minutes)
    end_utc = local_end + timedelta(minutes=tz_offset_minutes)
    return start_utc, end_utc


def get_local_date_for_utc_datetime(
    dt_utc: datetime, tz_offset_minutes: int = 0
) -> date:
    """
    Convert a UTC datetime to local calendar date using client timezone offset.
    local_dt = utc_dt - tz_offset_minutes
    """
    local_dt = dt_utc - timedelta(minutes=tz_offset_minutes)
    return local_dt.date()


def format_local_time(
    dt_utc: Optional[datetime], tz_offset_minutes: int = 0
) -> Optional[str]:
    """
    Format a UTC datetime as user-friendly local time, e.g. '12:45 PM'.
    """
    if not dt_utc:
        return None
    local_dt = dt_utc - timedelta(minutes=tz_offset_minutes)
    return local_dt.strftime("%-I:%M %p") if hasattr(local_dt, "strftime") else None
