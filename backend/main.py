from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import os
import json
import base64
from typing import Optional, Dict, Any
from pydantic import BaseModel
from enum import Enum
import uvicorn
from datetime import datetime
import logging
from dotenv import load_dotenv
from PIL import Image
import io
import mimetypes

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running" 
    SUCCESS = "success"
    FAILED = "failed"

class ImageTo3DRequest(BaseModel):
    model_version: Optional[str] = "v2.0-20240919"
    style: Optional[str] = None
    texture_resolution: Optional[int] = 1024
    remesh: Optional[str] = "none"

class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    input: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    progress: Optional[int] = None
    created_time: Optional[int] = None

# Initialize FastAPI app
app = FastAPI(
    title="Tripo3D Image to 3D API",
    description="Convert 2D images to 3D models using Tripo3D",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
TRIPO3D_API_KEY = os.getenv("TRIPO3D_API_KEY")
TRIPO3D_BASE_URL = "https://api.tripo3d.ai/v2/openapi"

if not TRIPO3D_API_KEY:
    logger.warning("TRIPO3D_API_KEY environment variable not set")
else:
    logger.info("TRIPO3D_API_KEY loaded successfully")

# In-memory storage for demo purposes (use Redis/database in production)
task_storage: Dict[str, TaskResponse] = {}

def optimize_image_for_upload(image_data: bytes, max_size: int = 1024) -> bytes:
    """Optimize image size and quality for upload"""
    try:
        with Image.open(io.BytesIO(image_data)) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P', 'LA'):
                if img.mode == 'P' and 'transparency' in img.info:
                    img = img.convert('RGBA')
                
                if img.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'RGBA':
                        background.paste(img, mask=img.split()[-1])
                    else:
                        background.paste(img, mask=img.split()[1])
                    img = background
                else:
                    img = img.convert('RGB')
            elif img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Resize if too large
            if max(img.size) > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Save as JPEG with good quality
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            
            result_data = output.getvalue()
            if len(result_data) > 5 * 1024 * 1024:  # 5MB limit
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=70, optimize=True)
                result_data = output.getvalue()
            
            return result_data
            
    except Exception as e:
        logger.warning(f"Could not optimize image: {e}, using original")
        return image_data

class Tripo3DClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = TRIPO3D_BASE_URL

    async def upload_image(self, image_data: bytes, filename: str) -> str:
        """Upload image using multipart form data (more reliable)"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                # Optimize image for upload
                optimized_image = optimize_image_for_upload(image_data)
                
                # Prepare multipart form data
                files = {
                    'file': (filename, optimized_image, 'image/jpeg')
                }
                
                data = {
                    'type': 'image'
                }
                
                logger.info(f"Uploading image: {filename} ({len(optimized_image)} bytes)")
                
                response = await client.post(
                    f"{self.base_url}/upload",
                    headers={
                        "Authorization": f"Bearer {self.api_key}"
                    },
                    files=files,
                    data=data
                )
                
                logger.info(f"Upload response status: {response.status_code}")
                logger.info(f"Upload response: {response.text}")
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Handle different response formats
                    if "data" in result:
                        if isinstance(result["data"], dict):
                            # Look for token in various possible keys
                            for key in ["image_token", "token", "file_token"]:
                                if key in result["data"]:
                                    return result["data"][key]
                        elif isinstance(result["data"], str):
                            return result["data"]
                    elif "token" in result:
                        return result["token"]
                    elif "image_token" in result:
                        return result["image_token"]
                    
                    # If we can't find a token, raise an error
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not extract token from upload response: {result}"
                    )
                else:
                    error_detail = f"Upload failed: Status {response.status_code}, Response: {response.text}"
                    logger.error(error_detail)
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=error_detail
                    )
                    
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="Upload timeout")
            except httpx.RequestError as e:
                raise HTTPException(status_code=500, detail=f"Upload request failed: {str(e)}")

    async def create_task(self, file_token: str, request_params: ImageTo3DRequest) -> str:
        """Create image to 3D conversion task"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                # Build payload according to Tripo3D API docs
                payload = {
                    "type": "image_to_model",
                    "file": {
                        "type": "image",
                        "file_token": file_token
                    }
                }
                
                # Add extra parameters if specified
                extra = {}
                if request_params.model_version:
                    extra["model_version"] = request_params.model_version
                if request_params.style and request_params.style != "none":
                    extra["style"] = request_params.style
                if request_params.texture_resolution:
                    extra["texture_resolution"] = request_params.texture_resolution
                if request_params.remesh and request_params.remesh != "none":
                    extra["remesh"] = request_params.remesh
                
                if extra:
                    payload["extra"] = extra
                
                logger.info(f"Creating task with payload: {json.dumps(payload, indent=2)}")
                
                response = await client.post(
                    f"{self.base_url}/task",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                logger.info(f"Task creation response status: {response.status_code}")
                logger.info(f"Task creation response: {response.text}")
                
                if response.status_code != 200:
                    error_detail = f"Failed to create task: Status {response.status_code}, Response: {response.text}"
                    logger.error(error_detail)
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=error_detail
                    )
                
                result = response.json()
                
                # Extract task_id from response
                if "data" in result and "task_id" in result["data"]:
                    return result["data"]["task_id"]
                elif "task_id" in result:
                    return result["task_id"]
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not extract task_id from response: {result}"
                    )
                
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="Task creation timeout")
            except httpx.RequestError as e:
                raise HTTPException(status_code=500, detail=f"Task creation request failed: {str(e)}")

    async def get_task_status(self, task_id: str) -> TaskResponse:
        """Get task status and results"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/task/{task_id}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Failed to get task status: Status {response.status_code}, Response: {response.text}"
                    )
                
                result = response.json()
                
                if "data" not in result:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Invalid task status response format: {result}"
                    )
                
                data = result["data"]
                
                return TaskResponse(
                    task_id=task_id,
                    status=TaskStatus(data["status"]),
                    input=data.get("input"),
                    output=data.get("output"),
                    progress=data.get("progress"),
                    created_time=data.get("created_time")
                )
                
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="Status check timeout")
            except httpx.RequestError as e:
                raise HTTPException(status_code=500, detail=f"Status check request failed: {str(e)}")

    async def download_file(self, url: str, filename: str) -> str:
        """Download 3D model file"""
        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                response = await client.get(url)
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Failed to download file: Status {response.status_code}"
                    )
                
                # Create downloads directory if it doesn't exist
                os.makedirs("downloads", exist_ok=True)
                
                file_path = f"downloads/{filename}"
                with open(file_path, "wb") as f:
                    f.write(response.content)
                
                logger.info(f"Downloaded file: {file_path} ({len(response.content)} bytes)")
                return file_path
                
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="Download timeout")
            except httpx.RequestError as e:
                raise HTTPException(status_code=500, detail=f"Download request failed: {str(e)}")

# Initialize Tripo3D client
tripo3d_client = None
if TRIPO3D_API_KEY:
    tripo3d_client = Tripo3DClient(TRIPO3D_API_KEY)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Tripo3D FastAPI Backend", 
        "status": "running",
        "api_configured": TRIPO3D_API_KEY is not None
    }

@app.post("/convert/image-to-3d")
async def convert_image_to_3d(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_version: str = Form("v2.0-20240919"),
    style: Optional[str] = Form(None),
    texture_resolution: int = Form(1024),
    remesh: str = Form("none")
):
    """Convert 2D image to 3D model"""
    
    if not tripo3d_client:
        raise HTTPException(
            status_code=500,
            detail="Tripo3D API key not configured"
        )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image. Received content type: {file.content_type}"
        )
    
    # Check file size (max 10MB)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size too large. Maximum size is 10MB."
        )
    
    try:
        # Read image data
        image_data = await file.read()
        
        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Received empty file")
        
        logger.info(f"Processing image: {file.filename} ({len(image_data)} bytes)")
        
        # Create request parameters
        request_params = ImageTo3DRequest(
            model_version=model_version,
            style=style if style and style != "none" else None,
            texture_resolution=texture_resolution,
            remesh=remesh
        )
        
        # Upload image and get token
        file_token = await tripo3d_client.upload_image(image_data, file.filename or "image.jpg")
        logger.info(f"Image uploaded successfully, token: {file_token}")
        
        # Create conversion task
        task_id = await tripo3d_client.create_task(file_token, request_params)
        logger.info(f"Task created successfully: {task_id}")
        
        # Store initial task info
        task_response = TaskResponse(
            task_id=task_id,
            status=TaskStatus.QUEUED,
            created_time=int(datetime.now().timestamp())
        )
        task_storage[task_id] = task_response
        
        # Start background task to monitor progress
        background_tasks.add_task(monitor_task_progress, task_id)
        
        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Image uploaded and conversion task started"
        }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Error converting image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Get task status and progress"""
    
    if not tripo3d_client:
        raise HTTPException(
            status_code=500,
            detail="Tripo3D API key not configured"
        )
    
    try:
        # Get latest status from Tripo3D API
        task_response = await tripo3d_client.get_task_status(task_id)
        
        # Update local storage
        task_storage[task_id] = task_response
        
        return task_response.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/task/{task_id}/download")
async def download_3d_model(task_id: str, format: str = "glb"):
    """Download the generated 3D model"""
    
    if not tripo3d_client:
        raise HTTPException(
            status_code=500,
            detail="Tripo3D API key not configured"
        )
    
    try:
        # Get task status to check if completed
        task_response = await tripo3d_client.get_task_status(task_id)
        
        if task_response.status != TaskStatus.SUCCESS:
            raise HTTPException(
                status_code=400,
                detail=f"Task not completed. Current status: {task_response.status}"
            )
        
        if not task_response.output or "model" not in task_response.output:
            raise HTTPException(
                status_code=404,
                detail="3D model not found in task output"
            )
        
        # Get download URL for requested format
        model_urls = task_response.output["model"]["urls"]
        
        if format not in model_urls:
            available_formats = list(model_urls.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Format '{format}' not available. Available formats: {available_formats}"
            )
        
        download_url = model_urls[format]
        filename = f"{task_id}.{format}"
        
        # Download and serve file
        file_path = await tripo3d_client.download_file(download_url, filename)
        
        return FileResponse(
            file_path,
            media_type="application/octet-stream",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading 3D model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def monitor_task_progress(task_id: str):
    """Background task to monitor conversion progress"""
    max_attempts = 120  # 10 minutes with 5-second intervals
    attempt = 0
    
    while attempt < max_attempts:
        try:
            if not tripo3d_client:
                break
                
            task_response = await tripo3d_client.get_task_status(task_id)
            task_storage[task_id] = task_response
            
            logger.info(f"Task {task_id} status: {task_response.status} (attempt {attempt + 1})")
            
            if task_response.status in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
                logger.info(f"Task {task_id} completed with status: {task_response.status}")
                break
                
            await asyncio.sleep(5)  # Wait 5 seconds before next check
            attempt += 1
            
        except Exception as e:
            logger.error(f"Error monitoring task {task_id}: {str(e)}")
            await asyncio.sleep(5)
            attempt += 1
    
    if attempt >= max_attempts:
        logger.warning(f"Task {task_id} monitoring timed out after {max_attempts} attempts")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
