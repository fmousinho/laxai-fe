# Backend Idempotency Implementation Required

## Problem
React Strict Mode (and potentially network issues/retries) can cause multiple task creation requests to hit the backend nearly simultaneously. Currently, this creates **duplicate tasks** which waste resources and create data inconsistencies.

## Current Behavior
```
POST /api/v1/track { video_filename: "test_video.mp4", tenant_id: "tenant1" }
→ Creates task: a8d08198-9e47-4cf2-bd45-54074cfca095

POST /api/v1/track { video_filename: "test_video.mp4", tenant_id: "tenant1" }  
→ Creates task: a79710e6-f11b-4a9f-b023-b5f99d1b4b1a (DUPLICATE!)

POST /api/v1/track { video_filename: "test_video.mp4", tenant_id: "tenant1" }
→ Creates task: 787d139f-63ff-44d1-a3f5-3ba3dd8d8fb3 (DUPLICATE!)
```

## Required Backend Changes

### Option 1: Check Before Insert (Recommended)
```python
def create_tracking_task(tenant_id: str, video_filename: str, **params):
    # Check for existing active task
    existing = db.query(TrackingTask).filter(
        TrackingTask.tenant_id == tenant_id,
        TrackingTask.video_filename == video_filename,
        TrackingTask.status.in_(['not_started', 'running'])
    ).first()
    
    if existing:
        return {
            "task_id": existing.task_id,
            "status": existing.status,
            "message": "Reusing existing active task",
            "reused": True,
            "created_at": existing.created_at
        }
    
    # Create new task only if no active task exists
    new_task = TrackingTask(
        tenant_id=tenant_id,
        video_filename=video_filename,
        **params
    )
    db.add(new_task)
    db.commit()
    
    return {
        "task_id": new_task.task_id,
        "status": new_task.status,
        "message": "Tracking job queued successfully",
        "reused": False,
        "created_at": new_task.created_at
    }
```

### Option 2: Database Unique Constraint
Add a partial unique index that prevents duplicate active tasks:

```sql
CREATE UNIQUE INDEX idx_active_task_per_tenant_video 
ON tracking_tasks (tenant_id, video_filename)
WHERE status IN ('not_started', 'running');
```

Then handle the duplicate key error:
```python
try:
    new_task = TrackingTask(...)
    db.add(new_task)
    db.commit()
except IntegrityError:
    # Duplicate active task exists
    existing = db.query(TrackingTask).filter(...).first()
    return {"task_id": existing.task_id, "reused": True, ...}
```

## Business Rule
**Only one video processing task per tenant at a time.**

This makes sense because:
1. Processing is resource-intensive
2. Results should be deterministic and not have race conditions
3. User can only work on one video at a time in the UI

## Testing
After implementing, test with:
```bash
# Send 3 simultaneous requests
curl -X POST $BACKEND_URL/api/v1/track \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"tenant1","video_filename":"test.mp4"}' &
  
curl -X POST $BACKEND_URL/api/v1/track \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"tenant1","video_filename":"test.mp4"}' &
  
curl -X POST $BACKEND_URL/api/v1/track \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"tenant1","video_filename":"test.mp4"}' &
```

Expected result: **All 3 requests return the same `task_id`**

## Current Frontend Mitigations
The frontend already has:
- localStorage cache to avoid redundant API calls
- Client-side deduplication in `AnalysingState.tsx`

However, these **cannot fully prevent duplicates** due to React Strict Mode's synchronous double-mounting. The backend MUST enforce idempotency.

## Status
❌ **NOT IMPLEMENTED** - Backend currently creates duplicate tasks
✅ **WORKAROUND** - Frontend caching reduces frequency but doesn't eliminate the issue
