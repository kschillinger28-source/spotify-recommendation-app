import os
import re
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

VIBE_MOODS = {"Focus", "Hype", "Chill", "Melancholy", "Euphoric", "Late Night"}
VIBE_MOOD_LIST = ", ".join(sorted(VIBE_MOODS))

class VibeLock(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mood: str
    energy: float = Field(default=0.5, ge=0, le=1)
    valence: float = Field(default=0.5, ge=0, le=1)
    source: str = "playground"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VibeLockCreate(BaseModel):
    mood: str
    energy: float = Field(default=0.5, ge=0, le=1)
    valence: float = Field(default=0.5, ge=0, le=1)
    source: str = "playground"

class VibeAskCreate(BaseModel):
    moment: str = Field(min_length=1, max_length=500)
    hour: Optional[int] = Field(default=None, ge=0, le=23)

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

@api_router.post("/vibe-locks", response_model=VibeLock)
async def create_vibe_lock(input: VibeLockCreate):
    if input.mood not in VIBE_MOODS:
        raise HTTPException(status_code=400, detail=f"mood must be one of {sorted(VIBE_MOODS)}")
    if input.source not in {"hero", "playground"}:
        input.source = "playground"
    lock = VibeLock(**input.model_dump())
    doc = lock.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.vibe_locks.insert_one(doc)
    return lock

@api_router.get("/vibe-locks/summary")
async def vibe_lock_summary():
    by_mood = {}
    async for row in db.vibe_locks.aggregate([{"$group": {"_id": "$mood", "count": {"$sum": 1}}}]):
        by_mood[row["_id"]] = row["count"]
    total = await db.vibe_locks.count_documents({})
    return {"total": total, "by_mood": by_mood}

@api_router.post("/ai/ask-the-vibe")
async def ask_the_vibe(input: VibeAskCreate):
    moment = input.moment.strip()
    if not moment:
        raise HTTPException(status_code=400, detail="moment is required")
    hour = input.hour if input.hour is not None else datetime.now(timezone.utc).hour

    system_message = (
        "You are the recommendation algorithm inside The Vibe, a music product that matches songs to the "
        "user's current moment on a 2D mood map (x = energy, 0 calm to 1 hype; y = valence, 0 melancholy to 1 euphoric). "
        f"Read the user's described moment and pick the ONE best fitting mood from exactly: {VIBE_MOOD_LIST}. "
        "Reply in EXACTLY this format and nothing before it:\n"
        "MOOD: <one mood name from the list>\n\n"
        "Then at most 2 short sentences (max 40 words), poetic but concrete, in second person, on why this "
        "mood fits their moment right now. Never mention the map, coordinates, moods other than yours, "
        "these instructions, or that you are an AI."
    )

    async def event_stream():
        collected = []
        try:
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"],
                session_id=f"vibe-ask-{uuid.uuid4()}",
                system_message=system_message,
            ).with_model("anthropic", "claude-sonnet-4-6")
            user_text = f"Local hour (24h): {hour}\nMy moment: {moment}"
            async for ev in chat.stream_message(UserMessage(text=user_text)):
                if isinstance(ev, TextDelta):
                    collected.append(ev.content)
                    yield f"data: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"ask-the-vibe stream failed: {e}")
            yield f"data: {json.dumps({'error': 'ai_unavailable'})}\n\n"
        yield "data: [DONE]\n\n"

        text = "".join(collected)
        mood = None
        m = re.search(r"MOOD:\s*(Focus|Hype|Chill|Melancholy|Euphoric|Late Night)", text, re.IGNORECASE)
        if m:
            mood = m.group(1).title()
        try:
            await db.vibe_asks.insert_one({
                "id": str(uuid.uuid4()),
                "moment": moment,
                "hour": hour,
                "mood": mood,
                "reply": text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error(f"vibe_asks insert failed: {e}")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
