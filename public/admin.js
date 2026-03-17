// ============================================
// Client Dashboard - Schema-Driven Admin
// ============================================

// Initialize Supabase
let supabaseClient = null;
if (window.CONFIG && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('login-error');
const siteKeyDisplay = document.getElementById('site-key-display');
const contentSections = document.getElementById('content-sections');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');
const retryBtn = document.getElementById('retry-btn');
const saveBar = document.getElementById('save-bar');
const uploadStatusEl = document.getElementById('upload-status');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');
const previewFrame = document.getElementById('admin-preview-frame');

// State
let isAuthenticated = false;
let hasUnsavedChanges = false;
let contentCache = {};
let sessionToken = null;
let activeUploads = 0;
let lastSaveTime = null;
let autoSaveTimer = null;
let saveTimeInterval = null;
let currentAdminPage = 'index';

// ============ UNDO/REDO SYSTEM ============
let changeHistory = [];
let historyIndex = -1;
let historyDebounceTimers = {};

function pushToHistory(section, field, oldValue, newValue) {
    if (oldValue === newValue) return;

    // Truncate any redo entries beyond current index
    if (historyIndex < changeHistory.length - 1) {
        changeHistory = changeHistory.slice(0, historyIndex + 1);
    }

    changeHistory.push({ section, field, oldValue, newValue });
    historyIndex = changeHistory.length - 1;
    updateUndoRedoButtons();
}

function performUndo() {
    if (historyIndex < 0) return;

    const entry = changeHistory[historyIndex];
    historyIndex--;

    const el = document.querySelector(
        `[data-section="${entry.section}"][data-field="${entry.field}"]`
    );
    if (el) {
        if (el.classList.contains('image-upload')) {
            // Cannot undo image uploads easily, skip
        } else {
            el.value = entry.oldValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    updateUndoRedoButtons();
    updatePreview();
}

function performRedo() {
    if (historyIndex >= changeHistory.length - 1) return;

    historyIndex++;
    const entry = changeHistory[historyIndex];

    const el = document.querySelector(
        `[data-section="${entry.section}"][data-field="${entry.field}"]`
    );
    if (el) {
        if (el.classList.contains('image-upload')) {
            // Cannot redo image uploads easily, skip
        } else {
            el.value = entry.newValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    updateUndoRedoButtons();
    updatePreview();
}

function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.disabled = historyIndex < 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= changeHistory.length - 1;
}

// ============ STRUCTURED ERROR HANDLING ============
async function handleError(error, context) {
    const status = error?.status || error?.statusCode || 0;
    const message = error?.message || String(error);

    // Auth errors (401/403)
    if (status === 401 || status === 403 || message.includes('JWT') || message.includes('token')) {
        showToast('Session expired. Please log in again.', 'error');
        // Trigger re-login after short delay
        setTimeout(() => {
            sessionToken = null;
            sessionStorage.removeItem('authenticated');
            sessionStorage.removeItem('session_token');
            isAuthenticated = false;
            loginScreen.style.display = 'flex';
            dashboard.style.display = 'none';
        }, 2000);
        return { retry: false };
    }

    // Data/validation errors (400)
    if (status === 400 || status === 422) {
        showToast(`${context}: ${message}`, 'error');
        return { retry: false };
    }

    // Transient errors (network, 5xx) -- caller handles retry
    if (status >= 500 || status === 0 || message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
        return { retry: true };
    }

    // Default: show error
    showToast(`${context}: ${message}`, 'error');
    return { retry: false };
}

async function withRetry(fn, context, maxRetries) {
    if (maxRetries === undefined) maxRetries = 3;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const result = await handleError(err, context);
            if (!result.retry || attempt === maxRetries) {
                throw err;
            }
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
            await new Promise(resolve => setTimeout(resolve, delay));
            if (attempt < maxRetries) {
                showToast(`Retrying ${context}... (attempt ${attempt + 2}/${maxRetries + 1})`, 'info');
            }
        }
    }
    throw lastError;
}

// ============ AUTO-SAVE ============
function resetAutoSaveTimer() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (hasUnsavedChanges && activeUploads === 0) {
            saveContent();
        }
    }, 3000);
}

function backupToLocalStorage() {
    if (!CONFIG || !CONFIG.SITE_KEY) return;
    const data = {};
    document.querySelectorAll('[data-section][data-field]').forEach(el => {
        const key = el.dataset.section + '.' + el.dataset.field;
        if (el.classList.contains('image-upload')) {
            const img = el.querySelector('.image-preview img');
            data[key] = (img && img.dataset.url) || '';
        } else {
            data[key] = el.value || '';
        }
    });
    try {
        localStorage.setItem('admin-backup-' + CONFIG.SITE_KEY, JSON.stringify(data));
    } catch (e) {
        // localStorage full or unavailable, ignore
    }
}

function restoreFromLocalStorage() {
    if (!CONFIG || !CONFIG.SITE_KEY) return;
    try {
        const raw = localStorage.getItem('admin-backup-' + CONFIG.SITE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        Object.keys(data).forEach(key => {
            const [section, field] = key.split('.');
            const el = document.querySelector(
                `[data-section="${section}"][data-field="${field}"]`
            );
            if (el && !el.classList.contains('image-upload') && !el.value) {
                el.value = data[key];
            }
        });
    } catch (e) {
        // corrupt data, ignore
    }
}

// Last saved timestamp display
function updateSaveTimeDisplay() {
    const timeEl = document.getElementById('save-time');
    if (!timeEl || !lastSaveTime) {
        if (timeEl) timeEl.textContent = '';
        return;
    }
    const seconds = Math.floor((Date.now() - lastSaveTime) / 1000);
    if (seconds < 10) {
        timeEl.textContent = '(just now)';
    } else if (seconds < 60) {
        timeEl.textContent = '(' + seconds + 's ago)';
    } else {
        const mins = Math.floor(seconds / 60);
        timeEl.textContent = '(' + mins + 'm ago)';
    }
}

// ============ LIVE PREVIEW ============
function updatePreview() {
    if (!previewFrame || !previewFrame.contentDocument) return;
    try {
        const doc = previewFrame.contentDocument;
        document.querySelectorAll('[data-section][data-field]').forEach(el => {
            const key = el.dataset.section + '.' + el.dataset.field;
            let value = '';
            if (el.classList.contains('image-upload')) {
                const img = el.querySelector('.image-preview img');
                value = (img && (img.dataset.url || img.src)) || '';
            } else {
                value = el.value || '';
            }

            // Find matching data-content elements in iframe
            const targets = doc.querySelectorAll('[data-content="' + key + '"]');
            targets.forEach(target => {
                if (target.tagName === 'IMG') {
                    if (value) target.src = value;
                } else if (target.tagName === 'A') {
                    target.textContent = value;
                } else {
                    target.textContent = value;
                }
            });
        });
    } catch (e) {
        // Cross-origin or iframe not ready, ignore
    }
}

// ============ THEME TOGGLE ============
function initTheme() {
    const saved = localStorage.getItem('admin-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? '' : 'light';
    if (next) {
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('admin-theme', next);
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('admin-theme');
    }
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}

// Get auth headers for authenticated Supabase requests
function getAuthHeaders() {
    return sessionToken ? { 'x-site-token': sessionToken } : {};
}

// ============ AUTHENTICATION ============

logoutBtn.addEventListener('click', async () => {
    // Invalidate the session token on the server
    if (supabaseClient && sessionToken) {
        try {
            await supabaseClient.rpc('site_logout', { p_token: sessionToken });
        } catch (err) {
            // Logout should succeed even if the RPC fails
        }
    }

    sessionToken = null;
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('session_token');
    isAuthenticated = false;
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    document.getElementById('password').value = '';
});

// Check for existing session or Supabase SSO
const storedToken = sessionStorage.getItem('session_token');
if (sessionStorage.getItem('authenticated') === 'true' && storedToken) {
    sessionToken = storedToken;
    isAuthenticated = true;
    // Recreate client with stored token in global headers
    if (supabaseClient) {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            global: { headers: { 'x-site-token': sessionToken } }
        });
    }
    showDashboard();
} else if (supabaseClient) {
    // Check for Supabase auth session (SSO from portal)
    checkSupabaseSession();
}

// ============ SUPABASE SSO ============
async function checkSupabaseSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session && session.user && session.user.email) {
            // Check if this user owns a site with this site_key
            const { data: builds } = await supabaseClient
                .from('site_builds')
                .select('id, submission_id')
                .eq('site_key', CONFIG.SITE_KEY)
                .maybeSingle();

            if (builds && builds.submission_id) {
                const { data: submission } = await supabaseClient
                    .from('submissions')
                    .select('email')
                    .eq('id', builds.submission_id)
                    .maybeSingle();

                if (submission && submission.email.toLowerCase() === session.user.email.toLowerCase()) {
                    // User owns this site! Create a session token for them
                    const { data: loginData } = await supabaseClient.rpc('site_sso_login', {
                        p_site_key: CONFIG.SITE_KEY,
                        p_email: session.user.email
                    });

                    if (loginData && loginData.length && loginData[0].token) {
                        sessionToken = loginData[0].token;
                        sessionStorage.setItem('session_token', sessionToken);
                        sessionStorage.setItem('authenticated', 'true');

                        // Recreate client with session token
                        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                            global: { headers: { 'x-site-token': sessionToken } }
                        });

                        isAuthenticated = true;
                        showDashboard();
                        showToast('Logged in via My Sites portal', 'success');
                    }
                }
            }
        }
    } catch (err) {
        // SSO failed, show normal login screen
        console.error('SSO check failed:', err);
    }
}

// ============ TOKEN-BASED LOGIN (NO PASSWORD) ============
// Check for #token= in URL (from portal "Edit Site" button)
async function checkTokenLogin() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#token=')) {
        try {
            const token = decodeURIComponent(hash.substring(7));
            // Clear the hash from URL for security
            history.replaceState(null, null, window.location.pathname + window.location.search);

            // Validate the token is a valid session token
            if (supabaseClient && token) {
                sessionToken = token;
                sessionStorage.setItem('session_token', sessionToken);
                sessionStorage.setItem('authenticated', 'true');

                // Recreate client with session token
                supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                    global: { headers: { 'x-site-token': sessionToken } }
                });

                isAuthenticated = true;
                showDashboard();
                showToast('Logged in from portal', 'success');
            }
        } catch (err) {
            console.error('Token login failed:', err);
        }
    }
}

// Check for token on load
if (!isAuthenticated) {
    checkTokenLogin();
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    siteKeyDisplay.textContent = CONFIG.SITE_KEY;

    // Generate form from schema
    generateFormFromSchema();

    // Load content
    loadContent();

    // Init mobile tab toggle
    initMobileTabToggle();

    // Start save-time updater
    if (saveTimeInterval) clearInterval(saveTimeInterval);
    saveTimeInterval = setInterval(updateSaveTimeDisplay, 30000);

    // Load agent readiness panel (async, non-blocking)
    setTimeout(loadAgentReadiness, 500);

    // Load domain status (async, non-blocking)
    setTimeout(loadDomainStatus, 300);

    // Set up iframe preview update on load
    if (previewFrame) {
        previewFrame.addEventListener('load', function() {
            // Delay slightly to let content load
            setTimeout(updatePreview, 300);
        });
    }
}

// ============ MOBILE TAB TOGGLE ============
function initMobileTabToggle() {
    const toggle = document.getElementById('mobile-tab-toggle');
    if (!toggle) return;
    const tabs = toggle.querySelectorAll('.mobile-tab');
    const previewPane = document.getElementById('preview-pane');
    const editorPane = document.getElementById('editor-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'preview') {
                previewPane.classList.remove('hidden-mobile');
                editorPane.classList.add('hidden-mobile');
            } else {
                editorPane.classList.remove('hidden-mobile');
                previewPane.classList.add('hidden-mobile');
            }
        });
    });

    // Default: show editor, hide preview on mobile
    if (window.innerWidth < 768) {
        previewPane.classList.add('hidden-mobile');
    }
}

// ============ MULTI-PAGE TABS ============
function isMultiPageSite() {
    return CONFIG.PAGES && CONFIG.PAGES.length > 1;
}

function initPageTabs() {
    const tabBar = document.getElementById('page-tabs-bar');
    if (!tabBar || !isMultiPageSite()) return;

    const pageLabels = { index: 'Home', about: 'About', services: 'Services', contact: 'Contact' };
    let tabsHtml = '';
    CONFIG.PAGES.forEach(page => {
        const label = pageLabels[page] || page.charAt(0).toUpperCase() + page.slice(1);
        const activeClass = page === currentAdminPage ? ' active' : '';
        tabsHtml += '<button class="admin-page-tab' + activeClass + '" data-page="' + escapeHtml(page) + '">' + escapeHtml(label) + '</button>';
    });
    tabBar.innerHTML = tabsHtml;
    tabBar.style.display = 'flex';

    tabBar.addEventListener('click', function(e) {
        const tab = e.target.closest('.admin-page-tab');
        if (!tab) return;
        const page = tab.dataset.page;
        if (page === currentAdminPage) return;
        switchAdminPage(page);
    });
}

function switchAdminPage(page) {
    currentAdminPage = page;

    // Update tab active state
    const tabBar = document.getElementById('page-tabs-bar');
    if (tabBar) {
        tabBar.querySelectorAll('.admin-page-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
    }

    // Show/hide sections based on page
    filterSectionsByPage();

    // Switch preview iframe
    if (previewFrame) {
        const pageFile = page === 'index' ? 'index.html' : page + '.html';
        previewFrame.src = pageFile;
        const urlBar = document.getElementById('preview-url-bar');
        if (urlBar) urlBar.textContent = pageFile;
    }
}

function filterSectionsByPage() {
    if (!isMultiPageSite()) return;
    const sections = contentSections.querySelectorAll('.editor-section');
    sections.forEach(el => {
        const sectionPage = el.dataset.page;
        // Sections without a page attribute belong to all pages (shared sections)
        // Sections with a page attribute only show on that page
        if (!sectionPage || sectionPage === currentAdminPage) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });
}

// ============ GENERATE FORM FROM SCHEMA ============
function generateFormFromSchema() {
    if (!CONFIG.SCHEMA || !CONFIG.SCHEMA.length) {
        contentSections.innerHTML = '<p class="error-text">No schema defined in config.js</p>';
        return;
    }

    let html = '';

    CONFIG.SCHEMA.forEach(section => {
        // Add data-page attribute for multi-page filtering
        const pageAttr = section.page ? ' data-page="' + escapeHtml(section.page) + '"' : '';
        html += `
            <section class="editor-section"${pageAttr}>
                <div class="section-header">
                    <h2>${escapeHtml(section.name)}</h2>
                    ${section.hint ? `<span class="section-hint">${escapeHtml(section.hint)}</span>` : ''}
                </div>
                <div class="section-content">
                    ${generateFieldsHtml(section.id, section.fields)}
                </div>
            </section>
        `;
    });

    contentSections.innerHTML = html;

    // Initialize page tabs if multi-page
    initPageTabs();
    if (isMultiPageSite()) {
        filterSectionsByPage();
    }

    // Attach event listeners for image uploads
    initImageUploads();

    // Track changes on all inputs (auto-save, backup, undo, preview)
    document.querySelectorAll('input:not([type="file"]), textarea').forEach(input => {
        // Store initial value for undo tracking
        let lastHistoryValue = input.value || '';
        let historyDebounce = null;

        input.addEventListener('input', () => {
            hasUnsavedChanges = true;
            updateSaveStatus('unsaved');
            resetAutoSaveTimer();
            backupToLocalStorage();
            updatePreview();

            // Debounced history push (500ms)
            const section = input.dataset.section;
            const field = input.dataset.field;
            if (section && field) {
                if (historyDebounce) clearTimeout(historyDebounce);
                const capturedOld = lastHistoryValue;
                historyDebounce = setTimeout(() => {
                    const newVal = input.value || '';
                    if (capturedOld !== newVal) {
                        pushToHistory(section, field, capturedOld, newVal);
                        lastHistoryValue = newVal;
                    }
                }, 500);
            }
        });
    });
}

function generateFieldsHtml(sectionId, fields) {
    // Detect xxxN_yyy patterns for grouping
    const groupPattern = /^(.+?)(\d+)_(.+)$/;
    const groups = {};
    const ungrouped = [];

    fields.forEach(field => {
        const match = field.id.match(groupPattern);
        if (match) {
            const prefix = match[1];
            const num = match[2];
            const suffix = match[3];
            const groupKey = prefix + num;
            if (!groups[groupKey]) {
                groups[groupKey] = { prefix, num: parseInt(num, 10), fields: [] };
            }
            groups[groupKey].fields.push(field);
        } else {
            ungrouped.push({ type: 'field', field });
        }
    });

    // Build ordered list: ungrouped fields and grouped fields in order
    // Figure out where groups fall relative to ungrouped fields
    const allItems = [];
    const processedGroups = new Set();

    fields.forEach(field => {
        const match = field.id.match(groupPattern);
        if (match) {
            const groupKey = match[1] + match[2];
            if (!processedGroups.has(groupKey)) {
                processedGroups.add(groupKey);
                allItems.push({ type: 'group', group: groups[groupKey], key: groupKey });
            }
        } else {
            allItems.push({ type: 'field', field });
        }
    });

    return allItems.map(item => {
        if (item.type === 'field') {
            return renderFieldHtml(sectionId, item.field);
        } else {
            const g = item.group;
            const label = capitalize(g.prefix) + ' ' + g.num;
            const innerHtml = g.fields.map(f => renderFieldHtml(sectionId, f)).join('');
            return `
                <div class="field-group">
                    <div class="field-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h4>${escapeHtml(label)}</h4>
                        <span class="field-group-toggle">&#9660;</span>
                    </div>
                    <div class="field-group-body">
                        ${innerHtml}
                    </div>
                </div>
            `;
        }
    }).join('');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderFieldHtml(sectionId, field) {
    const fieldId = `${sectionId}-${field.id}`;
    const dataAttrs = `data-section="${sectionId}" data-field="${field.id}"`;

    switch (field.type) {
        case 'text':
            return `
                <div class="form-group">
                    <label for="${fieldId}">${escapeHtml(field.label)}</label>
                    <input type="text"
                           id="${fieldId}"
                           ${dataAttrs}
                           placeholder="${escapeHtml(field.placeholder || '')}">
                </div>
            `;

        case 'textarea':
            return `
                <div class="form-group">
                    <label for="${fieldId}">${escapeHtml(field.label)}</label>
                    <textarea id="${fieldId}"
                              ${dataAttrs}
                              rows="3"
                              placeholder="${escapeHtml(field.placeholder || '')}"></textarea>
                </div>
            `;

        case 'image':
            return `
                <div class="form-group">
                    <label>${escapeHtml(field.label)}</label>
                    <div class="image-upload" ${dataAttrs}>
                        <input type="file" accept="image/*" class="image-input">
                        <div class="upload-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                            </svg>
                            <span>Click or drag to upload</span>
                        </div>
                        <div class="image-preview" style="display: none;">
                            <img src="" alt="Preview">
                            <button type="button" class="remove-image">&times;</button>
                        </div>
                    </div>
                </div>
            `;

        default:
            return '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
}

// ============ IMAGE UPLOAD HANDLERS ============
function initImageUploads() {
    document.querySelectorAll('.image-upload').forEach(upload => {
        const input = upload.querySelector('.image-input');
        const placeholder = upload.querySelector('.upload-placeholder');
        const preview = upload.querySelector('.image-preview');
        const img = preview.querySelector('img');
        const removeBtn = preview.querySelector('.remove-image');

        // Click to upload
        upload.addEventListener('click', (e) => {
            if (e.target !== removeBtn && !e.target.closest('.remove-image')) {
                input.click();
            }
        });

        // Drag and drop
        upload.addEventListener('dragover', (e) => {
            e.preventDefault();
            upload.classList.add('dragover');
        });

        upload.addEventListener('dragleave', () => {
            upload.classList.remove('dragover');
        });

        upload.addEventListener('drop', (e) => {
            e.preventDefault();
            upload.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleImageUpload(file, upload);
            }
        });

        // File input change
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) {
                handleImageUpload(file, upload);
            }
        });

        // Remove image
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            img.src = '';
            img.dataset.url = '';
            preview.style.display = 'none';
            placeholder.style.display = 'block';
            input.value = '';
            hasUnsavedChanges = true;
            updateSaveStatus('unsaved');
            resetAutoSaveTimer();
            backupToLocalStorage();
            updatePreview();
        });
    });
}

async function handleImageUpload(file, uploadEl) {
    const section = uploadEl.dataset.section;
    const field = uploadEl.dataset.field;
    const preview = uploadEl.querySelector('.image-preview');
    const placeholder = uploadEl.querySelector('.upload-placeholder');
    const img = preview.querySelector('img');

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        img.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);

    hasUnsavedChanges = true;
    updateSaveStatus('unsaved');

    // Upload to Supabase Storage
    if (supabaseClient) {
        // Show spinner overlay + track active uploads
        activeUploads++;
        updateUploadUI();
        let spinner = uploadEl.querySelector('.upload-spinner-overlay');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'upload-spinner-overlay';
            spinner.innerHTML = '<div class="upload-spinner"></div>';
            uploadEl.appendChild(spinner);
        } else {
            spinner.style.display = 'flex';
        }

        try {
            const fileName = `${CONFIG.SITE_KEY}/${section}-${field}-${Date.now()}.${file.name.split('.').pop()}`;

            const { data, error } = await supabaseClient.storage
                .from('site-images')
                .upload(fileName, file, {
                    upsert: true
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from('site-images')
                .getPublicUrl(fileName);

            img.dataset.url = urlData.publicUrl;
            showToast('Image uploaded!', 'success');
            updatePreview();

        } catch (err) {
            console.error('Error uploading image:', err);
            showToast('Failed to upload image', 'error');
        } finally {
            // Remove spinner, decrement counter
            if (spinner) spinner.style.display = 'none';
            activeUploads--;
            updateUploadUI();
        }
    }
}

function updateUploadUI() {
    if (uploadStatusEl) {
        uploadStatusEl.style.display = activeUploads > 0 ? 'inline' : 'none';
    }
    if (saveBtn) {
        saveBtn.disabled = activeUploads > 0;
    }
}

// ============ LOAD CONTENT ============
async function loadContent() {
    if (!supabaseClient) {
        // In demo mode, try restoring from localStorage
        restoreFromLocalStorage();
        return;
    }

    try {
        await withRetry(async () => {
            const { data, error } = await supabaseClient
                .from('site_content')
                .select('*')
                .eq('site_key', CONFIG.SITE_KEY);

            if (error) throw error;

            // Populate form fields
            data.forEach(item => {
                const key = `${item.section}.${item.field_name}`;
                contentCache[key] = item.content;

                // Find matching input
                const input = document.querySelector(
                    `[data-section="${item.section}"][data-field="${item.field_name}"]`
                );

                if (input) {
                    if (input.classList.contains('image-upload')) {
                        // Handle image
                        if (item.content) {
                            const preview = input.querySelector('.image-preview');
                            const placeholder = input.querySelector('.upload-placeholder');
                            const img = preview.querySelector('img');
                            img.src = item.content;
                            img.dataset.url = item.content;
                            preview.style.display = 'block';
                            placeholder.style.display = 'none';
                        }
                    } else {
                        // Handle text input
                        input.value = item.content || '';
                    }
                }
            });

            lastSaveTime = Date.now();
            updateSaveStatus('saved');
            updateSaveTimeDisplay();
            updatePreview();
        }, 'Loading content');

    } catch (err) {
        console.error('Error loading content:', err);
        showToast('Failed to load content', 'error');
        // Fall back to localStorage backup
        restoreFromLocalStorage();
    }
}

// ============ SAVE CONTENT ============
saveBtn.addEventListener('click', () => saveContent());

if (retryBtn) {
    retryBtn.addEventListener('click', () => saveContent());
}

async function saveContent() {
    if (!supabaseClient) {
        showToast('Demo mode: Changes not saved', 'error');
        return;
    }

    // Cancel any pending auto-save
    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    saveBtn.disabled = true;
    if (retryBtn) retryBtn.style.display = 'none';
    updateSaveStatus('saving');

    try {
        await withRetry(async () => {
            const updates = [];

            // Gather text inputs
            document.querySelectorAll('[data-section][data-field]').forEach(el => {
                const section = el.dataset.section;
                const field = el.dataset.field;

                let content = '';
                if (el.classList.contains('image-upload')) {
                    const img = el.querySelector('.image-preview img');
                    content = img.dataset.url || img.src || '';
                    // Don't save data: URLs (local previews)
                    if (content.startsWith('data:')) content = '';
                } else {
                    content = el.value || '';
                }

                updates.push({
                    site_key: CONFIG.SITE_KEY,
                    section: section,
                    field_name: field,
                    content: content,
                    updated_at: new Date().toISOString()
                });
            });

            // Upsert all content with session token header
            for (const update of updates) {
                const { error } = await supabaseClient
                    .from('site_content')
                    .upsert(update, {
                        onConflict: 'site_key,section,field_name'
                    });

                if (error) throw error;
            }
        }, 'Saving changes');

        hasUnsavedChanges = false;
        lastSaveTime = Date.now();
        updateSaveStatus('saved');
        updateSaveTimeDisplay();

        // Green flash
        if (saveBar) {
            saveBar.classList.add('just-saved');
            setTimeout(() => saveBar.classList.remove('just-saved'), 500);
        }

        showToast('Changes saved!', 'success');

        // Clear localStorage backup on successful save
        if (CONFIG && CONFIG.SITE_KEY) {
            try { localStorage.removeItem('admin-backup-' + CONFIG.SITE_KEY); } catch (e) {}
        }

    } catch (err) {
        console.error('Error saving:', err);
        updateSaveStatus('error');
        if (retryBtn) retryBtn.style.display = 'inline-flex';
        showToast('Failed to save changes', 'error');
    } finally {
        if (activeUploads === 0) {
            saveBtn.disabled = false;
        }
    }
}

// ============ UI HELPERS ============
function updateSaveStatus(status) {
    const statusText = saveStatus.querySelector('.status-text');

    saveStatus.classList.remove('saved', 'unsaved', 'saving', 'error');
    saveStatus.classList.add(status);

    // Update save bar state classes
    if (saveBar) {
        saveBar.classList.remove('unsaved', 'error');
        if (status === 'unsaved') saveBar.classList.add('unsaved');
        if (status === 'error') saveBar.classList.add('error');
    }

    switch (status) {
        case 'saved':
            statusText.textContent = 'All changes saved';
            break;
        case 'unsaved':
            statusText.textContent = 'Unsaved changes';
            break;
        case 'saving':
            statusText.textContent = 'Saving...';
            break;
        case 'error':
            statusText.textContent = 'Error saving';
            break;
    }
}

// ============ CONTEXT-AWARE TOAST ============
let toastTimer = null;
let toastHovered = false;

toast.addEventListener('mouseenter', () => {
    toastHovered = true;
    if (toastTimer) clearTimeout(toastTimer);
});

toast.addEventListener('mouseleave', () => {
    toastHovered = false;
    // Resume dismiss with remaining time (use 1s as minimum)
    scheduleToastDismiss(1000);
});

// Toast close button
const toastCloseBtn = toast.querySelector('.toast-close');
if (toastCloseBtn) {
    toastCloseBtn.addEventListener('click', () => {
        dismissToast();
    });
}

function showToast(message, type) {
    if (type === undefined) type = 'info';
    toast.querySelector('.toast-message').textContent = message;
    toast.className = 'toast visible ' + type;

    // Clear existing timer
    if (toastTimer) clearTimeout(toastTimer);
    toastHovered = false;

    // Context-aware durations
    let duration;
    switch (type) {
        case 'success': duration = 2500; break;
        case 'info':    duration = 4000; break;
        case 'error':   duration = 6000; break;
        default:        duration = 3000; break;
    }

    scheduleToastDismiss(duration);
}

function scheduleToastDismiss(duration) {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        if (!toastHovered) {
            dismissToast();
        }
    }, duration);
}

function dismissToast() {
    toast.classList.remove('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
}

// Warn on unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;

    // Ctrl/Cmd+S: Save
    if (mod && e.key === 's') {
        e.preventDefault();
        if (isAuthenticated && activeUploads === 0) {
            saveContent();
        }
        return;
    }

    // Ctrl/Cmd+Shift+Z: Redo
    if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        performRedo();
        return;
    }

    // Ctrl/Cmd+Z: Undo (must check after Shift+Z)
    if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
    }

    // Ctrl/Cmd+/: Toggle shortcuts help
    if (mod && e.key === '/') {
        e.preventDefault();
        toggleShortcutsOverlay();
        return;
    }

    // Escape: close shortcuts overlay
    if (e.key === 'Escape' && shortcutsOverlay && shortcutsOverlay.style.display !== 'none') {
        shortcutsOverlay.style.display = 'none';
    }
});

function toggleShortcutsOverlay() {
    if (!shortcutsOverlay) return;
    if (shortcutsOverlay.style.display === 'none') {
        shortcutsOverlay.style.display = 'flex';
    } else {
        shortcutsOverlay.style.display = 'none';
    }
}

if (shortcutsCloseBtn) {
    shortcutsCloseBtn.addEventListener('click', () => {
        shortcutsOverlay.style.display = 'none';
    });
}

// Close shortcuts overlay on backdrop click
if (shortcutsOverlay) {
    shortcutsOverlay.addEventListener('click', (e) => {
        if (e.target === shortcutsOverlay) {
            shortcutsOverlay.style.display = 'none';
        }
    });
}

// Undo/Redo buttons
if (undoBtn) undoBtn.addEventListener('click', performUndo);
if (redoBtn) redoBtn.addEventListener('click', performRedo);

// ============ AGENT READINESS ============
// Checks the live site for agent-readiness and shows score + AI preview

async function loadAgentReadiness() {
    const panel = document.getElementById('agent-readiness-panel');
    if (!panel || !CONFIG || !CONFIG.SITE_KEY) return;
    panel.style.display = 'block';

    try {
        // Fetch the live site HTML
        const siteUrl = window.location.origin + '/index.html';
        const response = await fetch(siteUrl);
        const html = await response.text();

        const checks = runAgentReadinessChecks(html);
        renderAgentReadiness(checks);
        renderAiPreview(html);
    } catch (err) {
        console.error('Agent readiness check failed:', err);
    }

    // Load AI traffic stats
    loadAiTraffic();
}

function runAgentReadinessChecks(html) {
    const checks = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // R-02: No opacity:0 on data-content
    const hasOpacityHide = html.includes('[data-content]') && html.includes('opacity: 0') || html.includes('opacity:0');
    checks.push({ id: 'R-02', label: 'Content visible without JS', pass: !hasOpacityHide, critical: true });

    // S-01: Has <main> element
    checks.push({ id: 'S-01', label: 'Has <main> landmark', pass: !!doc.querySelector('main'), critical: true });

    // S-02: Has exactly one h1
    const h1s = doc.querySelectorAll('h1');
    checks.push({ id: 'S-02', label: 'Single <h1> heading', pass: h1s.length === 1, critical: true });

    // S-03: Nav has aria-label
    const nav = doc.querySelector('nav');
    checks.push({ id: 'S-03', label: 'Nav has aria-label', pass: nav && nav.hasAttribute('aria-label'), critical: false });

    // S-06: Contact in <address>
    checks.push({ id: 'S-06', label: 'Contact in <address> element', pass: !!doc.querySelector('address'), critical: false });

    // S-07: All images have alt text
    const imgs = doc.querySelectorAll('img');
    const allAlts = Array.from(imgs).every(img => img.hasAttribute('alt') && img.alt.length > 2);
    checks.push({ id: 'S-07', label: 'All images have descriptive alt text', pass: imgs.length === 0 || allAlts, critical: true });

    // D-01: Has JSON-LD structured data
    const jsonLds = doc.querySelectorAll('script[type="application/ld+json"]');
    checks.push({ id: 'D-01', label: 'Has JSON-LD structured data', pass: jsonLds.length >= 2, critical: true });

    // M-01: Has title tag
    checks.push({ id: 'M-01', label: 'Has <title> tag', pass: !!doc.querySelector('title') && doc.title.length > 5, critical: true });

    // M-02: Has meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    checks.push({ id: 'M-02', label: 'Has meta description', pass: !!metaDesc && metaDesc.content.length > 20, critical: true });

    // M-03: Has Open Graph tags
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    checks.push({ id: 'M-03', label: 'Has Open Graph tags', pass: !!ogTitle, critical: false });

    // M-05: Has robots meta with max-snippet
    const robotsMeta = doc.querySelector('meta[name="robots"]');
    checks.push({ id: 'M-05', label: 'Robots meta with max-snippet', pass: !!robotsMeta && robotsMeta.content.includes('max-snippet'), critical: false });

    // P-01: Images have loading="lazy"
    const lazyImgs = Array.from(imgs).filter(img => img.hasAttribute('loading'));
    checks.push({ id: 'P-01', label: 'Images use lazy loading', pass: imgs.length === 0 || lazyImgs.length >= imgs.length / 2, critical: false });

    // P-03: Has preconnect hints
    const preconnects = doc.querySelectorAll('link[rel="preconnect"]');
    checks.push({ id: 'P-03', label: 'Has preconnect hints', pass: preconnects.length > 0, critical: false });

    // Content check: Enough visible text
    const mainEl = doc.querySelector('main');
    const textContent = mainEl ? mainEl.textContent.trim() : doc.body.textContent.trim();
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 1).length;
    checks.push({ id: 'R-02b', label: 'Has substantial text content (100+ words)', pass: wordCount >= 100, critical: true });

    // Footer exists
    checks.push({ id: 'S-09', label: 'Has <footer> element', pass: !!doc.querySelector('footer'), critical: false });

    return checks;
}

function renderAgentReadiness(checks) {
    const passCount = checks.filter(c => c.pass).length;
    const total = checks.length;
    const score = Math.round((passCount / total) * 100);

    const scoreEl = document.getElementById('ar-score');
    scoreEl.textContent = score + '%';
    scoreEl.className = 'ar-score ' + (score >= 80 ? 'ar-good' : score >= 50 ? 'ar-ok' : 'ar-bad');

    const checklist = document.getElementById('ar-checklist');
    checklist.innerHTML = checks.map(c => `
        <div class="ar-check ${c.pass ? 'ar-pass' : 'ar-fail'}">
            <span class="ar-check-icon">${c.pass ? '\u2713' : '\u2717'}</span>
            <span class="ar-check-label">${c.label}</span>
            ${c.critical ? '<span class="ar-critical">CRITICAL</span>' : ''}
        </div>
    `).join('');
}

function renderAiPreview(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract what AI crawlers see: headings + text content
    const preview = [];

    // Title
    if (doc.title) preview.push('TITLE: ' + doc.title);

    // Meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) preview.push('DESCRIPTION: ' + metaDesc.content);

    // Headings and content
    const mainEl = doc.querySelector('main') || doc.body;
    const headings = mainEl.querySelectorAll('h1, h2, h3');
    headings.forEach(h => {
        preview.push('\n' + h.tagName + ': ' + h.textContent.trim());
    });

    // Paragraphs
    const paragraphs = mainEl.querySelectorAll('p');
    paragraphs.forEach(p => {
        const text = p.textContent.trim();
        if (text.length > 10) preview.push(text);
    });

    // Contact info
    const address = doc.querySelector('address');
    if (address) preview.push('\nCONTACT: ' + address.textContent.trim());

    const previewEl = document.getElementById('ar-preview-content');
    previewEl.textContent = preview.join('\n');
}

async function loadAiTraffic() {
    if (!supabaseClient || !CONFIG.SITE_KEY) return;

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabaseClient
            .from('ai_visits')
            .select('visit_type, source')
            .eq('site_key', CONFIG.SITE_KEY)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (error || !data) return;

        const crawlers = data.filter(v => v.visit_type === 'crawler').length;
        const referrals = data.filter(v => v.visit_type === 'referral').length;

        document.getElementById('ar-crawlers').textContent = crawlers;
        document.getElementById('ar-referrals').textContent = referrals;

        // Group by source
        const sourceMap = {};
        data.forEach(v => {
            sourceMap[v.source] = (sourceMap[v.source] || 0) + 1;
        });
        const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const sourcesEl = document.getElementById('ar-traffic-sources');
        if (sources.length > 0) {
            sourcesEl.innerHTML = sources.map(([source, count]) =>
                '<div class="ar-source"><span>' + source + '</span><span>' + count + ' visits</span></div>'
            ).join('');
        } else {
            sourcesEl.innerHTML = '<p class="ar-no-data">No AI visits recorded yet</p>';
        }
    } catch (err) {
        console.error('Failed to load AI traffic:', err);
    }
}

// ============ DOMAIN STATUS ============

let _domainStatusTimer = null;

async function loadDomainStatus() {
    const section = document.getElementById('domain-status-section');
    if (!section || !CONFIG.SUPABASE_URL || !CONFIG.SITE_KEY) return;

    try {
        const res = await fetch(
            CONFIG.SUPABASE_URL + '/functions/v1/domain-status?site_key=' + encodeURIComponent(CONFIG.SITE_KEY),
            { headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY } }
        );
        const data = await res.json();

        if (data.domain_name) {
            renderDomainStatusPanel(section, data);
            // Poll while not active
            if (data.status !== 'active') {
                startDomainStatusPolling();
            } else {
                stopDomainStatusPolling();
            }
        } else {
            renderNoDomainPanel(section);
        }

        section.style.display = '';
    } catch (err) {
        console.error('Failed to load domain status:', err);
    }
}

function renderDomainStatusPanel(el, data) {
    const statusMap = {
        active: { label: 'Active', cls: 'ds-active' },
        registering: { label: 'Registering...', cls: 'ds-pending' },
        dns_propagating: { label: 'DNS Propagating...', cls: 'ds-pending' },
        renewal_failing: { label: 'Renewal Issue', cls: 'ds-error' },
        expiring: { label: 'Expiring', cls: 'ds-error' },
        expired: { label: 'Expired', cls: 'ds-error' },
        pending: { label: 'Setting up...', cls: 'ds-pending' },
    };
    const s = statusMap[data.status] || { label: data.status, cls: 'ds-pending' };
    const expiry = data.expires_at ? new Date(data.expires_at).toLocaleDateString() : '';

    let html = '<div class="ds-card">' +
        '<div class="ds-header">' +
            '<span class="ds-icon">&#127760;</span>' +
            '<span class="ds-title">Domain</span>' +
        '</div>' +
        '<div class="ds-body">' +
            '<div class="ds-domain-row">' +
                '<span class="ds-domain-name">' + data.domain_name + '</span>' +
                '<span class="ds-badge ' + s.cls + '">' + s.label + '</span>' +
            '</div>';

    if (data.ssl_active) {
        html += '<div class="ds-detail">&#128274; SSL Active</div>';
    }
    if (expiry) {
        html += '<div class="ds-detail">' + (data.auto_renew ? 'Auto-renews' : 'Expires') + ' on ' + expiry + '</div>';
    }

    html += '</div></div>';
    el.innerHTML = html;
}

function renderNoDomainPanel(el) {
    el.innerHTML = '<div class="ds-card ds-card-empty">' +
        '<div class="ds-header">' +
            '<span class="ds-icon">&#127760;</span>' +
            '<span class="ds-title">Domain</span>' +
        '</div>' +
        '<div class="ds-body">' +
            '<p class="ds-no-domain">No custom domain configured</p>' +
            '<a href="/portal.html" class="ds-get-domain-link" target="_blank" rel="noopener">Get a Domain &rarr;</a>' +
        '</div>' +
    '</div>';
}

function startDomainStatusPolling() {
    stopDomainStatusPolling();
    _domainStatusTimer = setInterval(loadDomainStatus, 10000);
}

function stopDomainStatusPolling() {
    if (_domainStatusTimer) {
        clearInterval(_domainStatusTimer);
        _domainStatusTimer = null;
    }
}
