# Tripo3D FastAPI Backend

A FastAPI backend service that integrates with Tripo3D's API to convert 2D images into 3D models.

## Features

- **Image Upload**: Upload 2D images (PNG, JPG, etc.)
- **3D Conversion**: Convert images to 3D models using Tripo3D's AI
- **Task Management**: Track conversion progress with task IDs
- **Multiple Formats**: Download 3D models in various formats (GLB, OBJ, etc.)
- **Background Processing**: Non-blocking conversion with progress monitoring
- **CORS Support**: Ready for frontend integration

## Quick Start

### 1. Installation

```bash
# Clone or download the files
# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Setup

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your Tripo3D API key
TRIPO3D_API_KEY=your_actual_api_key_here
```

### 3. Get Tripo3D API Key

1. Visit [Tripo3D Platform](https://platform.tripo3d.ai/)
2. Sign up and create an account
3. Navigate to API settings
4. Generate an API key
5. Add it to your `.env` file

### 4. Run the Server

```bash
# Development mode
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### 1. Convert Image to 3D Model

**POST** `/convert/image-to-3d`

Upload an image and start 3D conversion.

**Parameters:**
- `file` (form-data): Image file (PNG, JPG, etc.)
- `model_version` (optional): Model version (default: "v2.0-20240919")
- `style` (optional): Style preset (cartoon, realistic, sculpture, etc.)
- `texture_resolution` (optional): Texture resolution (default: 1024)
- `remesh` (optional): Remesh option (none, triangle, quad)

**Response:**
```json
{
  "task_id": "task_123456",
  "status": "queued",
  "message": "Image uploaded and conversion task started"
}
```

### 2. Check Task Status

**GET** `/task/{task_id}`

Get the current status and progress of a conversion task.

**Response:**
```json
{
  "task_id": "task_123456",
  "status": "running",
  "progress": 75,
  "created_time": 1699123456
}
```

Status values:
- `queued`: Task is waiting to start
- `running`: Conversion in progress
- `success`: Conversion completed
- `failed`: Conversion failed

### 3. Download 3D Model

**GET** `/task/{task_id}/download?format=glb`

Download the generated 3D model file.

**Parameters:**
- `format` (query): File format (glb, obj, fbx, etc.)

**Response:** Binary file download

### 4. List All Tasks

**GET** `/tasks`

Get a list of all conversion tasks.

### 5. Health Check

**GET** `/`

Basic health check endpoint.

## Usage Examples

### Using cURL

```bash
# Upload image and start conversion
curl -X POST "http://localhost:8000/convert/image-to-3d" \
  -F "file=@your_image.jpg" \
  -F "style=realistic" \
  -F "texture_resolution=1024"

# Check task status
curl "http://localhost:8000/task/task_123456"

# Download 3D model
curl -O "http://localhost:8000/task/task_123456/download?format=glb"
```

### Using Python Requests

```python
import requests
import time

# Upload image
with open("image.jpg", "rb") as f:
    response = requests.post(
        "http://localhost:8000/convert/image-to-3d",
        files={"file": f},
        data={"style": "realistic"}
    )

task_id = response.json()["task_id"]

# Poll for completion
while True:
    status_response = requests.get(f"http://localhost:8000/task/{task_id}")
    status = status_response.json()["status"]
    
    if status == "success":
        # Download the model
        model_response = requests.get(
            f"http://localhost:8000/task/{task_id}/download?format=glb"
        )
        with open("model.glb", "wb") as f:
            f.write(model_response.content)
        break
    elif status == "failed":
        print("Conversion failed")
        break
    
    time.sleep(5)  # Wait 5 seconds before checking again
```

### Using JavaScript/Fetch

```javascript
// Upload image
const formData = new FormData();
formData.append('file', imageFile);
formData.append('style', 'realistic');

const uploadResponse = await fetch('http://localhost:8000/convert/image-to-3d', {
  method: 'POST',
  body: formData
});

const { task_id } = await uploadResponse.json();

// Poll for completion
const checkStatus = async () => {
  const response = await fetch(`http://localhost:8000/task/${task_id}`);
  const { status } = await response.json();
  
  if (status === 'success') {
    // Download model
    const downloadUrl = `http://localhost:8000/task/${task_id}/download?format=glb`;
    window.open(downloadUrl);
  } else if (status !== 'failed') {
    setTimeout(checkStatus, 5000); // Check again in 5 seconds
  }
};

checkStatus();
```

## Configuration Options

The conversion process supports several parameters:

- **model_version**: AI model version to use
- **style**: Visual style (cartoon, realistic, sculpture, etc.)
- **texture_resolution**: Quality of textures (512, 1024, 2048)
- **remesh**: Mesh optimization (none, triangle, quad)

## Error Handling

The API includes comprehensive error handling:

- File validation (must be image type)
- API key validation
- Rate limiting awareness
- Network timeout handling
- Progress monitoring with retries

## Production Considerations

For production deployment:

1. **Database**: Replace in-memory task storage with Redis or database
2. **File Storage**: Use cloud storage (S3, GCS) instead of local files
3. **Environment**: Set proper environment variables
4. **Security**: Add authentication and input validation
5. **Monitoring**: Add logging and monitoring
6. **Scaling**: Consider horizontal scaling for high traffic

## Supported File Formats

**Input:** PNG, JPG, JPEG, WebP

**Output:** GLB, OBJ, FBX, STL, PLY (depends on Tripo3D API)

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Make sure `TRIPO3D_API_KEY` is set in your `.env` file

2. **"Failed to upload image"**
   - Check image file size and format
   - Verify internet connection

3. **"Task not completed"**
   - Conversion takes time (usually 1-5 minutes)
   - Check task status endpoint for progress

4. **"Format not available"**
   - Different tasks may support different output formats
   - Check available formats in task status response

### Logs

Check console output for detailed error messages and progress updates.

## License

MIT License - feel free to modify and use in your projects.