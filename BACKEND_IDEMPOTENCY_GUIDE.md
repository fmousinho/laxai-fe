# Backend Idempotency Implementation Guide

## Problem
Multiple concurrent requests to `POST /api/v1/track` with the same `video_filename` create duplicate analysis tasks on the server.

## Solution: Make the Backend Idempotent

### Recommended Implementation

Modify your backend `/api/v1/track` endpoint to:

1. **Check for existing tasks** before creating a new one
2. **Return existing task ID** if an analysis is already pending/running for the same video
3. **Create new task** only if no active analysis exists

### Pseudocode

```python
@app.post("/api/v1/track")
async def create_track(request: TrackRequest):
    tenant_id = request.tenant_id
    video_filename = request.video_filename
    
    # Check if there's already a pending/running task for this video
    existing_task = db.query(Tasks).filter(
        Tasks.tenant_id == tenant_id,
        Tasks.video_filename == video_filename,
        Tasks.status.in_(['not_started', 'running'])  # Active states
    ).first()
    
    if existing_task:
        logger.info(f"Returning existing task {existing_task.task_id} for {video_filename}")
        return {
            "task_id": existing_task.task_id,
            "status": existing_task.status,
            "message": "Analysis already in progress"
        }
    
    # Create new task if none exists
    new_task = Tasks(
        task_id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        video_filename=video_filename,
        status='not_started',
        created_at=datetime.utcnow()
    )
    db.add(new_task)
    db.commit()
    
    logger.info(f"Created new task {new_task.task_id} for {video_filename}")
    
    # Trigger async processing
    trigger_analysis_workflow(new_task.task_id)
    
    return {
        "task_id": new_task.task_id,
        "status": "not_started"
    }
```

### Alternative: Use Unique Constraint

Add a unique constraint on `(tenant_id, video_filename, status)` where status is in active states:

```sql
CREATE UNIQUE INDEX idx_active_tasks 
ON tasks (tenant_id, video_filename) 
WHERE status IN ('not_started', 'running');
```

Then handle the constraint violation:

```python
try:
    new_task = create_task(...)
    db.commit()
except IntegrityError:
    # Task already exists, fetch and return it
    existing_task = fetch_existing_task(tenant_id, video_filename)
    return existing_task
```

## Client-Side Workaround (Temporary)

We've implemented a **localStorage cache** in `AnalysingState.tsx` that:
- Caches task IDs per video filename
- Returns cached task ID instead of making duplicate API calls
- Clears cache when analysis completes/fails/is cancelled

**Key**: `analysis_task_${videoFilename}`

This prevents duplicate frontend requests but doesn't prevent issues if:
- User clears localStorage
- Multiple users analyze the same video
- User accesses from different browsers/devices

**The backend solution is the proper fix.**

## Benefits of Backend Idempotency

✅ Prevents duplicate resource creation
✅ Reduces server load
✅ Works across all clients
✅ Prevents race conditions
✅ Enables safe retries
✅ Better user experience (consistent task IDs)

## Testing

Test with concurrent requests:
```bash
# Send 3 concurrent requests for same video
for i in {1..3}; do
  curl -X POST http://localhost:8000/api/v1/track \
    -H "Content-Type: application/json" \
    -d '{"tenant_id": "tenant1", "video_filename": "test.mp4"}' &
done
wait

# Should see:
# - 1 new task created
# - 2 requests returning the same existing task_id
```
