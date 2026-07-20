"""
VoxAI Backend Server
- Serves all frontend static files (HTML, CSS, JS)
- Proxies /api/generate requests to Google Gemini API (no CORS issues)
- Stores the API key server-side only

Usage:
  python server.py

Or with a pre-configured API key (optional):
  set GEMINI_API_KEY=AIzaSy...
  python server.py
"""

import http.server
import json
import os
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
import time

PORT = 8000
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

class VoxAIHandler(http.server.SimpleHTTPRequestHandler):
    """Handles both static file serving and Gemini API proxying."""

    def log_message(self, format, *args):
        """Custom logger for cleaner output."""
        print(f"[VoxAI] {self.address_string()} - {format % args}")

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def end_headers(self):
        """Add Cache-Control headers to prevent browser caching."""
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        """Handle GET requests for static files or API queries."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        if path == "/api/list":
            self._handle_list_files()
        elif path == "/api/load":
            self._handle_load_file(parsed_url.query)
        else:
            super().do_GET()

    def do_POST(self):
        """Handle API requests."""
        if self.path.startswith("/api/generate"):
            self._handle_gemini_proxy()
        elif self.path.startswith("/api/whisper"):
            self._handle_whisper_proxy()
        elif self.path == "/api/save":
            self._handle_save_file()
        elif self.path == "/api/delete":
            self._handle_delete_file()
        else:
            self.send_error(404, "Not Found")

    def _handle_list_files(self):
        """List all saved sessions from the saved_files/ directory."""
        try:
            saved_dir = Path("saved_files")
            if not saved_dir.exists():
                saved_dir.mkdir(parents=True, exist_ok=True)
            
            files_list = []
            for filepath in saved_dir.glob("*.json"):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    # Get modification time
                    mtime = filepath.stat().st_mtime
                    import datetime
                    time_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                    
                    files_list.append({
                        "filename": filepath.name,
                        "display_name": data.get("display_name", filepath.stem.replace("_", " ")),
                        "timestamp": time_str,
                        "preview": data.get("transcript", "")[:100]
                    })
                except Exception as fe:
                    print(f"[VoxAI] Error reading file {filepath.name}: {fe}")
                    
            # Sort by newest modified first
            files_list.sort(key=lambda x: x["timestamp"], reverse=True)
            self._send_json_response(200, {"files": files_list})
        except Exception as e:
            print(f"[VoxAI] List files error: {e}")
            self._send_json_error(500, f"Server list error: {e}")

    def _handle_load_file(self, query_string):
        """Load a specific saved session by filename."""
        try:
            params = urllib.parse.parse_qs(query_string)
            filename = params.get("filename", [None])[0]
            
            if not filename:
                self._send_json_error(400, "Missing 'filename' parameter.")
                return
                
            # Basic path traversal prevention
            filename = os.path.basename(filename)
            filepath = Path("saved_files") / filename
            
            if not filepath.exists() or not filepath.is_file():
                self._send_json_error(404, f"File {filename} not found.")
                return
                
            with open(filepath, "r", encoding="utf-8") as f:
                file_data = json.load(f)
                
            file_data["filename"] = filename
            self._send_json_response(200, file_data)
        except Exception as e:
            print(f"[VoxAI] Load file error: {e}")
            self._send_json_error(500, f"Server load error: {e}")

    def _handle_save_file(self):
        """Save a new session or update an existing session."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body)
            
            display_name = request_data.get("filename", "").strip()
            transcript = request_data.get("transcript", "")
            ai_response = request_data.get("aiResponse", "")
            
            if not display_name:
                display_name = "Session"
                
            # Create safe filename
            import re
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\s]', '', display_name).strip().replace(" ", "_")
            if not safe_name:
                safe_name = "session"
                
            saved_dir = Path("saved_files")
            if not saved_dir.exists():
                saved_dir.mkdir(parents=True, exist_ok=True)
                
            # Unique filename check
            filepath = saved_dir / f"{safe_name}.json"
            
            file_content = {
                "display_name": display_name,
                "transcript": transcript,
                "aiResponse": ai_response
            }
            
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(file_content, f, ensure_ascii=False, indent=2)
                
            print(f"[VoxAI] Session saved: {filepath.name}")
            self._send_json_response(200, {
                "status": "success",
                "filename": filepath.name,
                "display_name": display_name
            })
        except Exception as e:
            print(f"[VoxAI] Save file error: {e}")
            self._send_json_error(500, f"Server save error: {e}")

    def _handle_delete_file(self):
        """Delete a saved session file."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body)

            filename = request_data.get("filename", "").strip()
            if not filename:
                self._send_json_error(400, "Missing 'filename' in request body.")
                return

            # Prevent path traversal
            filename = os.path.basename(filename)
            filepath = Path("saved_files") / filename

            if not filepath.exists():
                self._send_json_error(404, f"File '{filename}' not found.")
                return

            filepath.unlink()
            print(f"[VoxAI] Session deleted: {filename}")
            self._send_json_response(200, {"status": "deleted", "filename": filename})

        except Exception as e:
            print(f"[VoxAI] Delete file error: {e}")
            self._send_json_error(500, f"Server delete error: {e}")

    def _urlopen_with_retry(self, req, timeout=30, max_retries=3, initial_delay=2.0):
        """Execute urlopen with exponential backoff on HTTP 429 Rate Limit errors."""
        delay = initial_delay
        for attempt in range(max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.read(), resp.headers
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < max_retries:
                    retry_after = e.headers.get("Retry-After")
                    wait_time = delay
                    if retry_after:
                        try:
                            wait_time = float(retry_after)
                        except ValueError:
                            pass
                    print(f"[VoxAI] Rate limit (429) encountered. Retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait_time)
                    delay *= 1.5
                    continue
                raise e

    def _upload_file_to_gemini(self, api_key, filename, mime_type, file_bytes):
        """Upload a file to Google Gemini Files API using the resumable protocol."""
        init_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={api_key}"
        headers = {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(len(file_bytes)),
            "X-Goog-Upload-Header-Content-Type": mime_type,
            "Content-Type": "application/json"
        }
        init_body = json.dumps({"file": {"display_name": filename}}).encode("utf-8")
        req = urllib.request.Request(init_url, data=init_body, headers=headers, method="POST")
        
        body, headers = self._urlopen_with_retry(req, timeout=30)
        upload_url = headers.get("X-Goog-Upload-URL")
            
        if not upload_url:
            raise Exception("Failed to retrieve upload URL from Gemini Files API")
            
        # Upload binary data
        upload_req = urllib.request.Request(
            upload_url,
            data=file_bytes,
            headers={
                "Content-Length": str(len(file_bytes)),
                "X-Goog-Upload-Offset": "0",
                "X-Goog-Upload-Command": "upload, finalize"
            },
            method="POST"
        )
        
        resp_body, headers = self._urlopen_with_retry(upload_req, timeout=600)
        upload_info = json.loads(resp_body)
            
        file_info = upload_info.get("file", {})
        return file_info.get("uri"), file_info.get("name")

    def _delete_file_from_gemini(self, api_key, file_name):
        """Clean up the uploaded file from Google Gemini Files API."""
        delete_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}"
        req = urllib.request.Request(delete_url, method="DELETE")
        try:
            self._urlopen_with_retry(req, timeout=15)
            print(f"[VoxAI] Successfully deleted file from Gemini Files API: {file_name}")
        except Exception as e:
            print(f"[VoxAI] Warning: Failed to clean up file {file_name} from Gemini Files API: {e}")

    def _wait_for_file_active(self, api_key, file_name, timeout_seconds=300, poll_interval=1):
        """Poll the Gemini Files API status endpoint until the file is ACTIVE."""
        status_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}"
        req = urllib.request.Request(status_url, method="GET")
        
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            try:
                body, headers = self._urlopen_with_retry(req, timeout=15)
                file_info = json.loads(body)
                state = file_info.get("state", "UNKNOWN")
                print(f"[VoxAI] Polling file status for {file_name}: state={state}")
                
                if state == "ACTIVE":
                    return True
                elif state == "FAILED":
                    raise Exception("Gemini Files API failed to process the uploaded file.")
            except urllib.error.HTTPError as e:
                print(f"[VoxAI] HTTP error polling file status: {e.code}")
                # For non-transient status errors (unauthorized, not found), fail fast
                if e.code in [401, 403, 404]:
                    raise e
            except Exception as e:
                print(f"[VoxAI] Error polling file status: {e}")
                
            time.sleep(poll_interval)
            
        raise TimeoutError(f"File processing timed out in Gemini Files API after {timeout_seconds} seconds.")

    def _handle_gemini_proxy(self):
        """Proxy the request to Gemini API server-side, supporting both JSON prompts and raw binary uploads."""
        try:
            file_type = self.headers.get("X-File-Type")
            
            if file_type:
                # 1. Raw Binary File Upload Pathway
                api_key = self.headers.get("X-API-Key", "").strip()
                model = self.headers.get("X-Model", "gemini-2.0-flash").strip()
                filename = self.headers.get("X-File-Name", "uploaded_file").strip()
                prompt = self.headers.get("X-Prompt", "").strip()
                
                content_length = int(self.headers.get("Content-Length", 0))
                file_bytes = self.rfile.read(content_length)
                
                if not api_key:
                    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
                if not api_key:
                    self._send_json_error(400, "API key is required.")
                    return
                
                print(f"[VoxAI] Uploading file {filename} ({len(file_bytes)} bytes) to Gemini Files API...")
                file_uri, file_name = self._upload_file_to_gemini(api_key, filename, file_type, file_bytes)
                
                gemini_data = None
                valid_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"]
                if model not in valid_models:
                    model = "gemini-1.5-flash"
                fallback_models = [model] + [m for m in valid_models if m != model]

                try:
                    # Wait for file to become active
                    print(f"[VoxAI] Waiting for file {file_name} to become active...")
                    self._wait_for_file_active(api_key, file_name)
                    
                    for idx, current_model in enumerate(fallback_models):
                        try:
                            gemini_url = f"{GEMINI_BASE_URL}/{current_model}:generateContent?key={api_key}"
                            
                            parts = [
                                {
                                    "fileData": {
                                        "mimeType": file_type,
                                        "fileUri": file_uri
                                    }
                                },
                                {
                                    "text": prompt or "Listen to the audio/video media carefully and write down every spoken word as verbatim transcript text. Do not summarize, output only the transcribed speech text."
                                }
                            ]
                            
                            gemini_body = json.dumps({
                                "system_instruction": {
                                    "parts": [{"text": "You are VoxAI, an intelligent voice-and-text assistant. Process the user's prompt or transcribe the uploaded audio/video files accurately and helpfully. Keep transcriptions verbatim and clear."}]
                                },
                                "contents": [
                                    {
                                        "role": "user",
                                        "parts": parts
                                    }
                                ],
                                "generationConfig": {
                                    "temperature": 0.4,
                                    "maxOutputTokens": 4096
                                }
                            }).encode("utf-8")
                            
                            req = urllib.request.Request(
                                gemini_url,
                                data=gemini_body,
                                headers={
                                    "Content-Type": "application/json",
                                    "Accept": "application/json"
                                },
                                method="POST"
                            )
                            
                            print(f"[VoxAI] Requesting content generation for {file_name} using model {current_model}...")
                            response_body, headers = self._urlopen_with_retry(req, timeout=120)
                            gemini_data = json.loads(response_body)
                            model = current_model
                            break
                        except urllib.error.HTTPError as err:
                            if err.code in [404, 429] and idx < len(fallback_models) - 1:
                                print(f"[VoxAI] HTTP {err.code} on {current_model}. Retrying next model {fallback_models[idx + 1]}...")
                                continue
                            raise err
                finally:
                    self._delete_file_from_gemini(api_key, file_name)
                
                text_result = None
                candidates = gemini_data.get("candidates", []) if gemini_data else []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text_result = parts[0].get("text")
                
                if not text_result:
                    finish_reason = candidates[0].get("finishReason", "unknown") if candidates else "unknown"
                    self._send_json_error(502, f"Empty response from Gemini (finishReason: {finish_reason})")
                    return
                
                print(f"[VoxAI] Gemini response OK ({len(text_result)} chars)")
                self._send_json_response(200, {"text": text_result, "model": model})
                
            else:
                # 2. Regular JSON / Base64 Inline Pathway (For smaller JSON requests / backward compatibility)
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                request_data = json.loads(body)
                
                api_key = request_data.get("apiKey", "").strip()
                model = request_data.get("model", "gemini-2.0-flash").strip()
                prompt = request_data.get("prompt", "").strip()
                file_data = request_data.get("file")
                
                if not api_key:
                    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
                if not api_key:
                    self._send_json_error(400, "API key is required.")
                    return
                if not prompt and not file_data:
                    self._send_json_error(400, "Prompt or file is required.")
                    return
                
                valid_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"]
                if model not in valid_models:
                    model = "gemini-1.5-flash"
                fallback_models = [model] + [m for m in valid_models if m != model]
                gemini_data = None
                
                for idx, current_model in enumerate(fallback_models):
                    try:
                        gemini_url = f"{GEMINI_BASE_URL}/{current_model}:generateContent?key={api_key}"
                        
                        parts = []
                        if file_data:
                            parts.append({
                                "inlineData": {
                                    "mimeType": file_data.get("mimeType", "audio/mp3"),
                                    "data": file_data.get("data")
                                }
                            })
                        
                        default_text = "Listen to the audio/video media carefully and write down every spoken word as verbatim transcript text. Do not summarize, output only the transcribed speech text." if file_data else ""
                        text_prompt = prompt or default_text
                        
                        if text_prompt:
                            parts.append({"text": text_prompt})

                        if not parts:
                            self._send_json_error(400, "Request contains no valid prompt or file data.")
                            return
                        
                        gemini_body = json.dumps({
                            "system_instruction": {
                                "parts": [{"text": "You are VoxAI, an intelligent voice-and-text assistant. Process the user's prompt or transcribe the uploaded audio/video files accurately and helpfully. Keep transcriptions verbatim and clear."}]
                            },
                            "contents": [
                                {
                                    "role": "user",
                                    "parts": parts
                                }
                            ],
                            "generationConfig": {
                                "temperature": 0.4 if file_data else 0.7,
                                "maxOutputTokens": 4096 if file_data else 1024
                            }
                        }).encode("utf-8")
                        
                        req = urllib.request.Request(
                            gemini_url,
                            data=gemini_body,
                            headers={
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            },
                            method="POST"
                        )
                        
                        print(f"[VoxAI] Calling Gemini API: model={current_model}")
                        response_body, headers = self._urlopen_with_retry(req, timeout=120)
                        gemini_data = json.loads(response_body)
                        model = current_model
                        break
                    except urllib.error.HTTPError as err:
                        if err.code in [404, 429] and idx < len(fallback_models) - 1:
                            print(f"[VoxAI] HTTP {err.code} on {current_model}. Retrying next model {fallback_models[idx + 1]}...")
                            continue
                        raise err
                
                text_result = None
                candidates = gemini_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text_result = parts[0].get("text")
                
                if not text_result:
                    finish_reason = candidates[0].get("finishReason", "unknown") if candidates else "unknown"
                    self._send_json_error(502, f"Empty response from Gemini (finishReason: {finish_reason})")
                    return
                
                print(f"[VoxAI] Gemini response OK ({len(text_result)} chars)")
                self._send_json_response(200, {"text": text_result, "model": model})

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f"[VoxAI] Gemini HTTP error {e.code}: {error_body}")
            try:
                err_data = json.loads(error_body)
                err_msg = err_data.get("error", {}).get("message", error_body)
            except Exception:
                err_msg = error_body[:300]

            status_map = {
                400: f"Bad request: {err_msg}",
                401: f"Invalid API key (401): {err_msg}. Please check your API key in Settings.",
                403: f"API key forbidden (403): {err_msg}. Check API key restrictions in Google AI Studio.",
                404: f"API Key Error (404): Could not find model with your key ({err_msg}). Verify your key at https://aistudio.google.com/app/apikey",
                429: "Rate limit exceeded (429). Wait a moment and try again, or switch model in settings to 'Gemini 1.5 Flash'.",
            }
            user_msg = status_map.get(e.code, f"Gemini API Error {e.code}: {err_msg}")
            self._send_json_error(e.code if e.code < 600 else 502, user_msg)

        except urllib.error.URLError as e:
            print(f"[VoxAI] URL error: {e.reason}")
            self._send_json_error(503, f"Could not reach Gemini API: {e.reason}. Check your internet connection.")

        except json.JSONDecodeError as e:
            print(f"[VoxAI] JSON parse error: {e}")
            self._send_json_error(400, f"Invalid JSON in request: {e}")

        except TimeoutError:
            self._send_json_error(504, "Request to Gemini API timed out. Try again.")

        except Exception as e:
            print(f"[VoxAI] Unexpected error: {type(e).__name__}: {e}")
            self._send_json_error(500, f"Server error: {type(e).__name__}: {e}")

    def _handle_whisper_proxy(self):
        """Proxy speech transcription request to OpenAI Whisper API."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body)
            
            api_key = request_data.get("apiKey", "").strip() or os.environ.get("OPENAI_API_KEY", "").strip()
            if not api_key:
                self._send_json_error(400, "OpenAI API key is required for Whisper mode.")
                return

            file_info = request_data.get("file", {})
            file_b64 = file_info.get("data", "")
            filename = file_info.get("name", "audio.wav")
            mime_type = file_info.get("mimeType", "audio/wav")

            if not file_b64:
                self._send_json_error(400, "File data is required for Whisper transcription.")
                return

            import base64
            raw_bytes = base64.b64decode(file_b64)

            # Build multipart/form-data request for OpenAI Whisper API
            boundary = f"----WebKitFormBoundary{os.urandom(8).hex()}"
            body_parts = []

            # model field
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n".encode("utf-8"))

            # file field
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {mime_type}\r\n\r\n".encode("utf-8"))
            body_parts.append(raw_bytes)
            body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

            req_body = b"".join(body_parts)

            req = urllib.request.Request(
                "https://api.openai.com/v1/audio/transcriptions",
                data=req_body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": f"multipart/form-data; boundary={boundary}"
                },
                method="POST"
            )

            print(f"[VoxAI] Requesting OpenAI Whisper transcription for {filename} ({len(raw_bytes)} bytes)...")
            response_body, _ = self._urlopen_with_retry(req, timeout=120)
            whisper_res = json.loads(response_body)

            text_result = whisper_res.get("text", "")
            print(f"[VoxAI] Whisper response OK ({len(text_result)} chars)")
            self._send_json_response(200, {"text": text_result, "model": "whisper-1"})

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f"[VoxAI] Whisper HTTP error {e.code}: {error_body}")
            self._send_json_error(e.code if e.code < 600 else 502, f"OpenAI Whisper API Error {e.code}: {error_body[:200]}")
        except Exception as e:
            print(f"[VoxAI] Whisper error: {e}")
            self._send_json_error(500, f"Whisper error: {e}")

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _send_json_response(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_json_error(self, status: int, message: str):
        self._send_json_response(status, {"error": message})


if __name__ == "__main__":
    os.chdir(Path(__file__).parent)  # Serve files from the script's directory

    with http.server.ThreadingHTTPServer(("", PORT), VoxAIHandler) as httpd:
        print("=" * 55)
        print("  VoxAI Server running!")
        print(f"  Open: http://localhost:{PORT}")
        print("  Gemini proxy: http://localhost:{PORT}/api/generate")
        print("  Press Ctrl+C to stop")
        print("=" * 55)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[VoxAI] Server stopped.")
