/**
 * VoxAI - Core Client Application Logic
 * Integrates Web Speech Recognition, Speech Synthesis, UI Events, and Gemini API.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  
  const languageSelect = document.getElementById('languageSelect');
  const aiModeSelect = document.getElementById('aiModeSelect');
  const geminiConfigGroup = document.getElementById('geminiConfigGroup');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKey = document.getElementById('toggleApiKey');
  const geminiModelSelect = document.getElementById('geminiModelSelect');
  const voiceFeedbackToggle = document.getElementById('voiceFeedbackToggle');

  const statusBadge = document.getElementById('statusBadge');
  const statusText = statusBadge.querySelector('.status-text');
  const currentLangBadge = document.getElementById('currentLangBadge');
  
  const textarea = document.getElementById('transcriptionTextarea');
  const interimOverlay = document.getElementById('interimOverlay');
  
  const clearTextBtn = document.getElementById('clearTextBtn');
  const copyTextBtn = document.getElementById('copyTextBtn');
  const uploadFileBtn = document.getElementById('uploadFileBtn');
  const fileUploadInput = document.getElementById('fileUploadInput');
  const speechCard = document.querySelector('.speech-card');
  const sendToAiBtn = document.getElementById('sendToAiBtn');
  const micBtn = document.getElementById('micBtn');
  const micIcon = micBtn.querySelector('.mic-icon');
  const stopIcon = micBtn.querySelector('.stop-icon');
  const micHint = document.getElementById('micHint');
  const micTriggerContainer = micBtn.parentElement;

  const ttsBtn = document.getElementById('ttsBtn');
  const copyAiBtn = document.getElementById('copyAiBtn');
  const clearAiBtn = document.getElementById('clearAiBtn');
  const aiEmptyState = document.getElementById('aiEmptyState');
  const aiOutputContainer = document.getElementById('aiOutputContainer');
  const aiTextContent = document.getElementById('aiTextContent');
  const aiLoader = document.getElementById('aiLoader');
  const toast = document.getElementById('toast');
  const workspaceGrid = document.querySelector('.workspace-grid');
  const workspaceResizer = document.getElementById('workspaceResizer');

  // Save/Load file elements
  const saveFileBtn    = document.getElementById('saveFileBtn');
  const viewSavedBtn   = document.getElementById('viewSavedBtn');
  const docStatusBadge = document.getElementById('docStatusBadge');
  const docStatusText  = docStatusBadge.querySelector('.doc-status-text');
  const filesListModal = document.getElementById('filesListModal');
  const closeFilesListModal = document.getElementById('closeFilesListModal');
  const savedFilesList = document.getElementById('savedFilesList');
  const saveNameModal  = document.getElementById('saveNameModal');
  const closeSaveNameModal = document.getElementById('closeSaveNameModal');
  const sessionNameInput   = document.getElementById('sessionNameInput');
  const confirmSaveBtn     = document.getElementById('confirmSaveBtn');

  // --- App State ---
  let isListening = false;
  let recognition = null;
  let speechUtterance = null;
  let confirmedTranscript = '';
  let aiResponseRaw = '';
  let restartTimeout = null;
  let isDirty = false;

  // --- Initialization ---
  loadSettings();
  initSpeechRecognition();
  updateLangIndicator();
  checkTextareaEmpty();

  // --- Settings (Local Storage) ---
  function saveSettings() {
    localStorage.setItem('voxai_aiMode', aiModeSelect.value);
    localStorage.setItem('voxai_apiKey', apiKeyInput.value);
    localStorage.setItem('voxai_model', geminiModelSelect.value);
    localStorage.setItem('voxai_voiceFeedback', voiceFeedbackToggle.checked);
    localStorage.setItem('voxai_lang', languageSelect.value);
  }

  function loadSettings() {
    const aiMode = localStorage.getItem('voxai_aiMode') || 'local';
    const apiKey = localStorage.getItem('voxai_apiKey') || '';
    const model = localStorage.getItem('voxai_model') || 'gemini-3.5-flash';
    const voiceFeedback = localStorage.getItem('voxai_voiceFeedback') !== 'false';
    const lang = localStorage.getItem('voxai_lang') || 'en-US';

    aiModeSelect.value = aiMode;
    apiKeyInput.value = apiKey;
    geminiModelSelect.value = model;
    voiceFeedbackToggle.checked = voiceFeedback;
    languageSelect.value = lang;

    toggleGeminiConfigUI(aiMode);
  }

  function toggleGeminiConfigUI(mode) {
    if (mode === 'gemini') {
      geminiConfigGroup.classList.remove('hidden');
    } else {
      geminiConfigGroup.classList.add('hidden');
    }
  }

  // --- Sidebar Events ---
  openSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarBackdrop.classList.add('active');
  });

  const closeSidebarFunc = () => {
    sidebar.classList.remove('active');
    sidebarBackdrop.classList.remove('active');
  };

  closeSidebar.addEventListener('click', closeSidebarFunc);
  sidebarBackdrop.addEventListener('click', closeSidebarFunc);

  // --- Sidebar Drag-to-Resize ---
  let isResizing = false;

  const savedWidth = localStorage.getItem('voxai_sidebarWidth');
  if (savedWidth) {
    const widthVal = parseInt(savedWidth, 10);
    if (!isNaN(widthVal) && widthVal >= 280 && widthVal <= 600) {
      sidebar.style.width = `${widthVal}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${widthVal}px`);
    }
  }

  sidebarResizer.addEventListener('mousedown', () => {
    isResizing = true;
    sidebarResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let newWidth = e.clientX;
    const minWidth = 280;
    const maxWidth = Math.min(600, window.innerWidth * 0.8);
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    sidebar.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      sidebarResizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalWidth = parseInt(sidebar.style.width, 10);
      if (!isNaN(finalWidth)) localStorage.setItem('voxai_sidebarWidth', finalWidth);
    }
  });

  sidebarResizer.addEventListener('touchstart', () => {
    isResizing = true;
    sidebarResizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isResizing || e.touches.length === 0) return;
    let newWidth = e.touches[0].clientX;
    const minWidth = 280;
    const maxWidth = Math.min(600, window.innerWidth * 0.8);
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    sidebar.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isResizing) {
      isResizing = false;
      sidebarResizer.classList.remove('dragging');
      document.body.style.userSelect = '';
      const finalWidth = parseInt(sidebar.style.width, 10);
      if (!isNaN(finalWidth)) localStorage.setItem('voxai_sidebarWidth', finalWidth);
    }
  });

  // --- Workspace Split Drag-to-Resize ---
  let isWorkspaceResizing = false;

  const savedSplit = localStorage.getItem('voxai_workspaceSplit');
  if (savedSplit) {
    const splitVal = parseFloat(savedSplit);
    if (!isNaN(splitVal) && splitVal >= 20 && splitVal <= 80) {
      document.documentElement.style.setProperty('--speech-card-width', `calc(${splitVal}% - 10px)`);
    }
  }

  workspaceResizer.addEventListener('mousedown', () => {
    isWorkspaceResizing = true;
    workspaceResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isWorkspaceResizing) return;
    const gridRect = workspaceGrid.getBoundingClientRect();
    let percentage = ((e.clientX - gridRect.left) / gridRect.width) * 100;
    const minPct = 25;
    const maxPct = 75;
    if (percentage < minPct) percentage = minPct;
    if (percentage > maxPct) percentage = maxPct;
    document.documentElement.style.setProperty('--speech-card-width', `calc(${percentage}% - 10px)`);
  });

  window.addEventListener('mouseup', () => {
    if (isWorkspaceResizing) {
      isWorkspaceResizing = false;
      workspaceResizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const speechCard = document.querySelector('.speech-card');
      const gridRect = workspaceGrid.getBoundingClientRect();
      const cardRect = speechCard.getBoundingClientRect();
      const pct = (cardRect.width / gridRect.width) * 100;
      localStorage.setItem('voxai_workspaceSplit', pct.toFixed(2));
    }
  });

  workspaceResizer.addEventListener('touchstart', () => {
    isWorkspaceResizing = true;
    workspaceResizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isWorkspaceResizing || e.touches.length === 0) return;
    const gridRect = workspaceGrid.getBoundingClientRect();
    let percentage = ((e.touches[0].clientX - gridRect.left) / gridRect.width) * 100;
    const minPct = 25;
    const maxPct = 75;
    if (percentage < minPct) percentage = minPct;
    if (percentage > maxPct) percentage = maxPct;
    document.documentElement.style.setProperty('--speech-card-width', `calc(${percentage}% - 10px)`);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isWorkspaceResizing) {
      isWorkspaceResizing = false;
      workspaceResizer.classList.remove('dragging');
      document.body.style.userSelect = '';
      const speechCard = document.querySelector('.speech-card');
      const gridRect = workspaceGrid.getBoundingClientRect();
      const cardRect = speechCard.getBoundingClientRect();
      const pct = (cardRect.width / gridRect.width) * 100;
      localStorage.setItem('voxai_workspaceSplit', pct.toFixed(2));
    }
  });

  // --- Settings Changed Events ---
  aiModeSelect.addEventListener('change', (e) => {
    toggleGeminiConfigUI(e.target.value);
    saveSettings();
  });
  apiKeyInput.addEventListener('input', saveSettings);
  geminiModelSelect.addEventListener('change', saveSettings);
  voiceFeedbackToggle.addEventListener('change', saveSettings);
  languageSelect.addEventListener('change', () => {
    saveSettings();
    updateLangIndicator();
    if (isListening) {
      isListening = false;
      try { recognition.stop(); } catch(e) {}
      setTimeout(() => startRecognition(), 400);
    }
  });

  toggleApiKey.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
  });

  // --- Web Speech API ---
  function createRecognitionInstance() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    return rec;
  }

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      updateStatus('error', 'Unsupported Browser');
      showToast('Speech Recognition not supported. Use Chrome or Edge.', 'error');
      micBtn.disabled = true;
      micHint.textContent = 'Requires Chrome, Edge, or Safari browser';
      return;
    }
    recognition = createRecognitionInstance();
  }

  function bindRecognitionEvents() {
    if (!recognition) return;

    recognition.onstart = () => {
      updateStatus('listening', 'Listening');
      micBtn.classList.add('listening');
      micTriggerContainer.classList.add('listening');
      micIcon.classList.add('hidden');
      stopIcon.classList.remove('hidden');
      micHint.textContent = 'Listening… speak now';
    };

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          confirmedTranscript += result[0].transcript + ' ';
        } else {
          interimText += result[0].transcript;
        }
      }
      textarea.value = confirmedTranscript + interimText;
      checkTextareaEmpty();
      if (interimText.trim().length > 0) {
        interimOverlay.textContent = '🎙 ' + interimText;
        interimOverlay.classList.add('active');
      } else {
        interimOverlay.classList.remove('active');
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListening = false;
        showToast('Microphone access denied. Check browser permissions.', 'error');
        updateStatus('error', 'Mic Blocked');
        setUItoStopped();
      } else if (event.error === 'network') {
        showToast('Network error with speech service. Retrying…', 'error');
      } else if (event.error === 'aborted' || event.error === 'no-speech') {
        // handled by onend
      } else {
        showToast(`Recognition error: ${event.error}`, 'error');
      }
    };

    recognition.onend = () => {
      interimOverlay.classList.remove('active');
      if (isListening) {
        updateStatus('listening', 'Listening');
        restartTimeout = setTimeout(() => {
          if (isListening) {
            recognition = createRecognitionInstance();
            bindRecognitionEvents();
            recognition.lang = languageSelect.value;
            try { recognition.start(); } catch (e) { console.warn('Restart failed:', e); }
          }
        }, 250);
      } else {
        setUItoStopped();
      }
    };
  }

  function setUItoStopped() {
    updateStatus('stopped', 'Ready');
    micBtn.classList.remove('listening');
    micTriggerContainer.classList.remove('listening');
    micIcon.classList.remove('hidden');
    stopIcon.classList.add('hidden');
    micHint.textContent = 'Click the mic or press Space to start listening';
    interimOverlay.classList.remove('active');
  }

  function startRecognition() {
    if (!recognition) return;
    if (restartTimeout) clearTimeout(restartTimeout);
    isListening = true;
    recognition = createRecognitionInstance();
    bindRecognitionEvents();
    recognition.lang = languageSelect.value;
    try {
      recognition.start();
    } catch (e) {
      console.error('Start error:', e);
      isListening = false;
      showToast('Could not start microphone. Check browser permissions.', 'error');
    }
  }

  function stopRecognition() {
    isListening = false;
    if (restartTimeout) clearTimeout(restartTimeout);
    if (!recognition) { setUItoStopped(); return; }
    try { recognition.stop(); } catch (e) { setUItoStopped(); }
  }

  function toggleRecognition() {
    if (isListening) stopRecognition();
    else startRecognition();
  }

  micBtn.addEventListener('click', toggleRecognition);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement !== textarea && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      toggleRecognition();
    }
  });

  textarea.addEventListener('input', () => {
    confirmedTranscript = textarea.value;
    checkTextareaEmpty();
  });

  function checkTextareaEmpty() {
    sendToAiBtn.disabled = textarea.value.trim().length === 0;
  }

  function updateStatus(state, label) {
    statusBadge.className = `status-badge ${state}`;
    statusText.textContent = label;
  }

  function updateLangIndicator() {
    currentLangBadge.textContent = languageSelect.options[languageSelect.selectedIndex].text;
  }

  // --- Toolbar Controls ---
  clearTextBtn.addEventListener('click', () => {
    textarea.value = '';
    confirmedTranscript = '';
    checkTextareaEmpty();
    interimOverlay.textContent = '';
    interimOverlay.classList.remove('active');
    showToast('Text cleared', 'success');
  });

  copyTextBtn.addEventListener('click', () => {
    if (!textarea.value.trim()) return;
    navigator.clipboard.writeText(textarea.value)
      .then(() => showToast('Transcribed text copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy text.', 'error'));
  });

  // --- File Upload & Transcription Handling ---
  uploadFileBtn.addEventListener('click', () => {
    if (isListening) {
      stopRecognition();
    }
    fileUploadInput.click();
  });

  fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
    fileUploadInput.value = '';
  });

  // Drag and Drop listeners
  speechCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    speechCard.classList.add('drag-over');
  });

  speechCard.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    speechCard.classList.remove('drag-over');
  });

  speechCard.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    speechCard.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (isListening) {
        stopRecognition();
      }
      handleFileUpload(files[0]);
    }
  });

  async function handleFileUpload(file) {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      showToast('Please upload an audio or video file.', 'error');
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB limit (Gemini Files API limit)
    if (file.size > MAX_SIZE) {
      showToast('File is too large. Max supported size is 2 GB.', 'error');
      return;
    }

    let uploadFile = file;
    let uploadName = file.name;
    let uploadType = file.type;
    const fileMbStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    try {
      const aiMode = aiModeSelect.value;
      if (aiMode === 'local') {
        setTranscriptionLoading(true, `Uploading & Transcribing ${file.name} (${fileMbStr})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const simulatedText = `[Simulated Transcription of ${file.name}]\nThis is a mock transcription of your uploaded ${file.type.split('/')[0]} file. To get real transcription, please configure your Gemini API Key in Settings and switch the AI Mode to "Google Gemini API".`;
        insertTranscription(simulatedText);
        showToast('File transcribed successfully (Simulated)!', 'success');
      } else {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          sidebar.classList.add('active');
          sidebarBackdrop.classList.add('active');
          setTimeout(() => apiKeyInput.focus(), 300);
          throw new Error('Gemini API Key missing! Enter your API key in Settings, or switch AI Mode to "Intelligent Local Agent".');
        }

        // Optimize smaller media files (<50MB) by extracting audio in browser.
        // For larger files (>=50MB), skip in-browser decoding to avoid RAM crash and upload directly to Gemini Files API.
        if ((file.type.startsWith('video/') || file.type.startsWith('audio/')) && file.size < 50 * 1024 * 1024) {
          setTranscriptionLoading(true, `Optimizing media for rapid upload (extracting audio track)...`);
          try {
            const audioBlob = await extractAudioFromMedia(file);
            uploadFile = audioBlob;
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            uploadName = `${baseName}.wav`;
            uploadType = 'audio/wav';
            console.log(`[VoxAI] Media optimized. Original size: ${file.size} bytes. Optimized size: ${audioBlob.size} bytes.`);
          } catch (optimizeErr) {
            console.warn('[VoxAI] Could not extract/optimize audio, sending original file:', optimizeErr);
          }
        }

        setTranscriptionLoading(true, `Uploading & Transcribing ${file.name} (${fileMbStr})...`);

        const model = geminiModelSelect.value;
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'X-Model': model,
            'X-File-Name': uploadName,
            'X-File-Type': uploadType
          },
          body: uploadFile
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Server error ${response.status}`);
        }

        const data = await response.json();
        if (!data.text) {
          throw new Error('Received an empty response from transcription service.');
        }

        insertTranscription(data.text);
        showToast('File transcribed successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error occurred during transcription.', 'error');
    } finally {
      setTranscriptionLoading(false);
    }
  }

  async function extractAudioFromMedia(file) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Resample to 16kHz mono (ideal for speech-to-text, low bandwidth)
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1, // mono
      Math.ceil(decodedBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    const renderedBuffer = await offlineCtx.startRendering();
    return bufferToWav(renderedBuffer);
  }

  function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // raw PCM
    const bitDepth = 16;
    
    let result;
    if (numOfChan === 2) {
      result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
      result = buffer.getChannelData(0);
    }
    
    const bufferArr = new ArrayBuffer(44 + result.length * 2);
    const view = new DataView(bufferArr);
    
    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + result.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, result.length * 2, true);
    
    floatTo16BitPCM(view, 44, result);
    
    return new Blob([view], { type: 'audio/wav' });
  }

  function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    
    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  function setTranscriptionLoading(isLoading, message = '') {
    if (isLoading) {
      textarea.disabled = true;
      micBtn.disabled = true;
      uploadFileBtn.disabled = true;
      clearTextBtn.disabled = true;
      copyTextBtn.disabled = true;
      sendToAiBtn.disabled = true;
      textarea.value = '';
      interimOverlay.textContent = message;
      interimOverlay.classList.add('active');
    } else {
      textarea.disabled = false;
      micBtn.disabled = false;
      uploadFileBtn.disabled = false;
      clearTextBtn.disabled = false;
      copyTextBtn.disabled = false;
      interimOverlay.textContent = '';
      interimOverlay.classList.remove('active');
      checkTextareaEmpty();
    }
  }

  function insertTranscription(text) {
    textarea.value = text;
    confirmedTranscript = text;
    markDirty();
    checkTextareaEmpty();
  }

  // --- Text-To-Speech ---
  function speakText(text) {
    window.speechSynthesis.cancel();
    if (!text) return;
    speechUtterance = new SpeechSynthesisUtterance(text);
    const lang = languageSelect.value;
    speechUtterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.includes(lang.split('-')[0]));
    if (matchingVoice) speechUtterance.voice = matchingVoice;

    speechUtterance.onstart = () => {
      ttsBtn.classList.add('active');
      ttsBtn.querySelector('span').textContent = 'Stop Speaking';
      ttsBtn.style.borderColor = 'var(--color-teal)';
    };
    speechUtterance.onend = () => {
      ttsBtn.classList.remove('active');
      ttsBtn.querySelector('span').textContent = 'Read Aloud';
      ttsBtn.style.borderColor = '';
    };
    speechUtterance.onerror = () => {
      ttsBtn.classList.remove('active');
      ttsBtn.querySelector('span').textContent = 'Read Aloud';
      ttsBtn.style.borderColor = '';
    };
    window.speechSynthesis.speak(speechUtterance);
  }

  ttsBtn.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      ttsBtn.classList.remove('active');
      ttsBtn.querySelector('span').textContent = 'Read Aloud';
      ttsBtn.style.borderColor = '';
    } else {
      speakText(aiResponseRaw);
    }
  });

  copyAiBtn.addEventListener('click', () => {
    if (!aiResponseRaw) return;
    navigator.clipboard.writeText(aiResponseRaw)
      .then(() => showToast('AI response copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy AI response.', 'error'));
  });

  // --- Clear AI Response ---
  clearAiBtn.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    ttsBtn.classList.remove('active');
    ttsBtn.querySelector('span').textContent = 'Read Aloud';
    ttsBtn.style.borderColor = '';

    aiResponseRaw = '';
    aiOutputContainer.classList.add('hidden');
    aiEmptyState.classList.remove('hidden');

    ttsBtn.disabled = true;
    copyAiBtn.disabled = true;
    clearAiBtn.disabled = true;

    markDirty();
    showToast('AI response cleared', 'success');
  });

  // --- AI Agent Integration ---
  sendToAiBtn.addEventListener('click', async () => {
    const textPrompt = textarea.value.trim();
    if (!textPrompt) return;

    window.speechSynthesis.cancel();

    aiEmptyState.classList.add('hidden');
    aiOutputContainer.classList.add('hidden');
    aiLoader.classList.remove('hidden');
    sendToAiBtn.disabled = true;
    ttsBtn.disabled = true;
    copyAiBtn.disabled = true;
    clearAiBtn.disabled = true;
    updateStatus('processing', 'AI Composing...');

    try {
      const mode = aiModeSelect.value;
      if (mode === 'gemini') {
        await handleGeminiApiCall(textPrompt);
      } else {
        await handleLocalAgentMock(textPrompt);
      }

      aiLoader.classList.add('hidden');
      aiOutputContainer.classList.remove('hidden');
      aiTextContent.innerHTML = parseMarkdown(aiResponseRaw);
      ttsBtn.disabled = false;
      copyAiBtn.disabled = false;
      clearAiBtn.disabled = false;
      checkTextareaEmpty();
      updateStatus('stopped', 'Ready');
      markDirty();

      if (voiceFeedbackToggle.checked) speakText(aiResponseRaw);
      showToast('AI response ready!', 'success');

    } catch (error) {
      console.error('AI error:', error);
      aiLoader.classList.add('hidden');
      aiOutputContainer.classList.remove('hidden');
      aiTextContent.innerHTML = `
        <div style="color:#ef4444; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:16px;">
          <strong>⚠️ Error</strong><br/><br/>
          ${escapeHtml(error.message || 'Unknown error occurred.')}
        </div>`;
      checkTextareaEmpty();
      ttsBtn.disabled = true;
      copyAiBtn.disabled = true;
      clearAiBtn.disabled = true;
      updateStatus('error', 'AI Error');
      showToast(error.message || 'AI failed', 'error');
    }
  });

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function handleGeminiApiCall(prompt) {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      sidebar.classList.add('active');
      sidebarBackdrop.classList.add('active');
      setTimeout(() => apiKeyInput.focus(), 300);
      throw new Error('Please enter your Gemini API key in Settings first.');
    }

    const model = geminiModelSelect.value;
    const proxyUrl = '/api/generate';
    const requestBody = { apiKey, model, prompt };

    let response;
    try {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } catch (networkErr) {
      throw new Error(
        'Cannot reach the VoxAI local server.\n\n' +
        'Make sure you started the server with:\n  python server.py\n\n' +
        `Error: ${networkErr.message}`
      );
    }

    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('Could not parse the server response. Is the Python server running?'); }

    if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
    if (!data.text) throw new Error('Received an empty response from Gemini. Try rephrasing your prompt.');

    aiResponseRaw = data.text;
  }

  async function handleLocalAgentMock(prompt) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const promptLower = prompt.toLowerCase();
    const isHindi = languageSelect.value === 'hi-IN' || /[\u0900-\u097F]/.test(prompt);

    if (isHindi) {
      if (promptLower.includes('अनुवाद') || promptLower.includes('translate')) {
        aiResponseRaw = `### अनुवाद परिणाम (Translation Results)\n\nमैंने आपके पाठ का अनुवाद किया है:\n\n* **मूल हिंदी पाठ**: "${prompt}"\n* **English Translation**: "I have processed your speech input."\n\n---\n> 💡 **सुझाव**: आप सेटिंग में भाषा बदलकर सीधे अंग्रेजी या हिंदी में निर्देशित कर सकते हैं।`;
      } else if (promptLower.includes('मदद') || promptLower.includes('help')) {
        aiResponseRaw = `### आपकी सहायता के लिए प्रस्तुत है (VoxAI Help)\n\nनमस्ते! मैं आपकी भाषा को पाठ में बदलने और निम्नलिखित कार्यों में सहायता कर सकता हूँ:\n\n1. **ईमेल या संदेश लिखना**\n2. **अनुवाद**: हिंदी से अंग्रेजी या अंग्रेजी से हिंदी\n3. **कोड समस्या**: कोडिंग सम्बन्धी प्रश्नों के उत्तर`;
      } else {
        aiResponseRaw = `### VoxAI हिंदी विश्लेषक\n\nनमस्ते! मैंने आपकी आवाज़ को हिंदी में सफलतापूर्वक सुना:\n\n> **"${prompt}"**\n\n#### मुख्य बिंदु:\n* **पहचानी गई भाषा**: हिंदी (hi-IN)\n* **शब्द गणना**: ${prompt.split(/\s+/).length} शब्द`;
      }
      return;
    }

    if (promptLower.includes('translate') || promptLower.includes('hindi')) {
      aiResponseRaw = `### Translation Engine (English ➔ Hindi)\n\n**Original:** > "${prompt}"\n\n**Translated (Hindi):** > "मैंने आपके बोले गए शब्दों का हिंदी में अनुवाद कर दिया है।"\n\n---\n* *Speech* ➔ आवाज़ / भाषण\n* *Translation* ➔ अनुवाद`;
    } else if (promptLower.includes('code') || promptLower.includes('program') || promptLower.includes('javascript') || promptLower.includes('html')) {
      aiResponseRaw = `### Developer Agent - Code Generator\n\n\`\`\`javascript\n// Speech Recognition Helper\nexport function initSpeechRecognizer(onResultCallback) {\n  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;\n  if (!SpeechRecognition) return null;\n  const recognizer = new SpeechRecognition();\n  recognizer.continuous = true;\n  recognizer.interimResults = false;\n  recognizer.onresult = (event) => {\n    const result = event.results[event.results.length - 1][0].transcript;\n    onResultCallback(result);\n  };\n  return recognizer;\n}\n\`\`\`\n\n#### Next Steps:\n1. Import this helper in your main bundle.\n2. Pass a callback to handle results.\n3. Call \`recognizer.start()\` to engage the microphone.`;
    } else if (promptLower.includes('email') || promptLower.includes('write') || promptLower.includes('letter')) {
      aiResponseRaw = `### Professional Writer Agent\n\n**Subject:** Follow-up: VoxAI Session\n\nDear Team,\n\nI am writing to share a summary of our recent session. Here is the dictation captured:\n> "${prompt}"\n\nBest regards,\n**Dictated via VoxAI**`;
    } else if (promptLower.includes('explain') || promptLower.includes('what') || promptLower.includes('why')) {
      aiResponseRaw = `### Explainer Agent\n\nYou asked about: **"${prompt}"**\n\nHere is how Speech-to-Text works:\n\n1. **Acoustic Wave Analysis**: The browser captures audio via the microphone.\n2. **Spectrogram Generation**: Waveform sliced into frequency spectra.\n3. **Phoneme Mapping**: Deep learning maps frequencies to phonetic sounds.\n4. **Language Model Alignment**: Phonemes aligned with dictionary words in real time.\n\n---\n> 💡 *Use the Gemini API key in Settings for advanced AI responses.*`;
    } else {
      aiResponseRaw = `# VoxAI Intelligent Summary\n\nI've processed your speech dictation:\n\n### Dictated Text\n> "${prompt}"\n\n### Summary & Analytics\n* **Word Count**: ${prompt.split(/\s+/).length} words\n* **Detected Intent**: Informational Prompt\n\n### Actions Performed\n1. **Grammar Normalization**: Analyzed text syntax.\n2. **Draft Compilation**: Markdown outline formatted above.\n\n---\n*Tip: Toggle "Gemini API" in Settings for complex AI tasks!*`;
    }
  }

  // --- Markdown Parser ---
  function parseMarkdown(mdText) {
    if (!mdText) return '';
    let html = mdText;
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) =>
      `<pre><code class="language-${lang || 'txt'}">${code.trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n\n/g, '</p><p>');
    if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<ul') && !html.startsWith('<blockquote')) {
      html = '<p>' + html + '</p>';
    }
    return html;
  }

  // --- Toast Utilities ---
  let toastTimeout = null;
  function showToast(message, type = 'info') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  // =========================================================
  // --- Save / Load File System ---
  // =========================================================

  function markDirty() {
    if (isDirty) return;
    isDirty = true;
    docStatusBadge.className = 'doc-status-badge unsaved';
    docStatusText.textContent = 'Unsaved Changes';
  }

  function markSaved() {
    isDirty = false;
    docStatusBadge.className = 'doc-status-badge saved';
    docStatusText.textContent = 'Saved';
  }

  textarea.addEventListener('input', markDirty);

  function openModal(modal) { modal.classList.add('open'); }
  function closeModal(modal) { modal.classList.remove('open'); }

  filesListModal.addEventListener('click', (e) => { if (e.target === filesListModal) closeModal(filesListModal); });
  saveNameModal.addEventListener('click', (e) => { if (e.target === saveNameModal) closeModal(saveNameModal); });
  closeFilesListModal.addEventListener('click', () => closeModal(filesListModal));
  closeSaveNameModal.addEventListener('click', () => closeModal(saveNameModal));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(filesListModal);
      closeModal(saveNameModal);
    }
  });

  saveFileBtn.addEventListener('click', () => {
    const hasContent = textarea.value.trim() || aiResponseRaw;
    if (!hasContent) {
      showToast('Nothing to save — type or record some text first.', 'error');
      return;
    }
    const autoName = textarea.value.trim().split(' ').slice(0, 4).join(' ') || 'Session';
    sessionNameInput.value = autoName;
    openModal(saveNameModal);
    setTimeout(() => sessionNameInput.select(), 100);
  });

  confirmSaveBtn.addEventListener('click', doSaveFile);
  sessionNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSaveFile(); });

  async function doSaveFile() {
    const name = sessionNameInput.value.trim();
    if (!name) { sessionNameInput.focus(); return; }
    confirmSaveBtn.disabled = true;
    confirmSaveBtn.textContent = 'Saving...';
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: name, transcript: textarea.value, aiResponse: aiResponseRaw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      closeModal(saveNameModal);
      markSaved();
      showToast(`✅ Session "${data.display_name}" saved!`, 'success');
    } catch (err) {
      showToast(`Save error: ${err.message}`, 'error');
    } finally {
      confirmSaveBtn.disabled = false;
      confirmSaveBtn.textContent = 'Save Now';
    }
  }

  viewSavedBtn.addEventListener('click', async () => {
    savedFilesList.innerHTML = '<div class="loading-spinner">Loading saved files...</div>';
    openModal(filesListModal);
    await refreshFilesList();
  });

  async function refreshFilesList() {
    try {
      const res = await fetch('/api/list');
      const data = await res.json();
      const files = data.files || [];
      if (files.length === 0) {
        savedFilesList.innerHTML = `<div class="empty-files-msg"><span class="empty-files-icon">📭</span>No saved sessions yet.<br>Click "Save File" to save your current session.</div>`;
        return;
      }
      savedFilesList.innerHTML = files.map(f => `
        <div class="saved-file-item">
          <div class="saved-file-icon">📄</div>
          <div class="saved-file-info">
            <div class="saved-file-name">${escapeHtml(f.display_name)}</div>
            <div class="saved-file-meta">${escapeHtml(f.timestamp)}</div>
            ${f.preview ? `<div class="saved-file-preview">${escapeHtml(f.preview)}...</div>` : ''}
          </div>
          <div class="saved-file-actions">
            <button class="load-file-btn" data-filename="${escapeHtml(f.filename)}">Load</button>
            <button class="delete-file-btn" data-filename="${escapeHtml(f.filename)}" title="Delete">🗑</button>
          </div>
        </div>`).join('');

      savedFilesList.querySelectorAll('.load-file-btn').forEach(btn => {
        btn.addEventListener('click', () => loadSavedFile(btn.dataset.filename));
      });
      savedFilesList.querySelectorAll('.delete-file-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSavedFile(btn.dataset.filename));
      });
    } catch (err) {
      savedFilesList.innerHTML = `<div class="empty-files-msg">Failed to load files: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadSavedFile(filename) {
    try {
      const res = await fetch(`/api/load?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');

      confirmedTranscript = data.transcript || '';
      textarea.value = confirmedTranscript;
      checkTextareaEmpty();

      if (data.aiResponse) {
        aiResponseRaw = data.aiResponse;
        aiEmptyState.classList.add('hidden');
        aiOutputContainer.classList.remove('hidden');
        aiTextContent.innerHTML = parseMarkdown(aiResponseRaw);
        ttsBtn.disabled = false;
        copyAiBtn.disabled = false;
        clearAiBtn.disabled = false;
      } else {
        aiResponseRaw = '';
        aiOutputContainer.classList.add('hidden');
        aiEmptyState.classList.remove('hidden');
        ttsBtn.disabled = true;
        copyAiBtn.disabled = true;
        clearAiBtn.disabled = true;
      }

      closeModal(filesListModal);
      markSaved();
      showToast(`📂 Session "${data.display_name}" loaded!`, 'success');
    } catch (err) {
      showToast(`Load error: ${err.message}`, 'error');
    }
  }

  async function deleteSavedFile(filename) {
    if (!confirm(`Delete "${filename.replace('.json', '').replace(/_/g, ' ')}"? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      showToast('Session deleted.', 'success');
      await refreshFilesList();
    } catch (err) {
      showToast(`Delete error: ${err.message}`, 'error');
    }
  }

});
