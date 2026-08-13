/* =====================================================
   GLOBAL VARIABLES
===================================================== */
const API_URL = '/api';
let user = null;
let isAdmin = false;
let teams = [];
let pollingInterval = null;

// Initialize state on load
function initApp() {
    const token = sessionStorage.getItem('token');
    const role = sessionStorage.getItem('role');
    const storedUser = sessionStorage.getItem('user');

    if (token) {
        if (role === 'admin') {
            isAdmin = true;
            user = null;
            openApp();
            fetchAdminTeams();
            startPolling();
        } else if (role === 'participant' && storedUser) {
            isAdmin = false;
            user = JSON.parse(storedUser);
            openApp();
            refreshParticipantDashboard(false);
            fetchPublicSchedule();
            startPolling();
        }
    }
}

/* =====================================================
   API HELPERS
===================================================== */
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const token = sessionStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    let config = { method, headers };
    if (body) {
        if (body instanceof FormData) {
            config.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
    }

    const res = await fetch(`${API_URL}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'API error');
    }
    return data;
}

/* =====================================================
   TOAST
===================================================== */
function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => { t.classList.add("hidden"); }, 3500);
}

/* =====================================================
   LOGIN SWITCH
===================================================== */
function showAdminLogin() {
    document.getElementById("participantLogin").classList.add("hidden");
    document.getElementById("adminLogin").classList.remove("hidden");
    document.getElementById("showAdminBtn").classList.add("hidden");
    document.getElementById("backParticipantBtn").classList.remove("hidden");
}

function showParticipantLogin() {
    document.getElementById("adminLogin").classList.add("hidden");
    document.getElementById("participantLogin").classList.remove("hidden");
    document.getElementById("showAdminBtn").classList.remove("hidden");
    document.getElementById("backParticipantBtn").classList.add("hidden");
}

/* =====================================================
   PARTICIPANT LOGIN
===================================================== */
async function participantLogin(e) {
    e.preventDefault();
    const name = document.getElementById("teamLogin").value.trim();
    const email = document.getElementById("emailLogin").value.trim();
    const year = document.getElementById("yearLogin").value;
    const password = document.getElementById("passwordLogin").value;

    if (!name || !email || !year || !password) return toast("Please fill in all fields.");

    try {
        const data = await fetchAPI('/participant/login', 'POST', { name, email, year, password });
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', 'participant');
        sessionStorage.setItem('user', JSON.stringify(data.team));
        user = data.team;
        isAdmin = false;
        openApp();
        fetchPublicSchedule();
        startPolling();
        toast("Participant login successful.");
    } catch (err) {
        toast(err.message);
    }
}

/* =====================================================
   ADMIN LOGIN
===================================================== */
async function adminLogin(e) {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    try {
        const data = await fetchAPI('/admin/login', 'POST', { email, password });
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', 'admin');
        user = null;
        isAdmin = true;
        openApp();
        fetchAdminTeams();
        startPolling();
        toast("Admin login successful.");
    } catch (err) {
        toast(err.message);
    }
}

/* =====================================================
   OPEN APP
===================================================== */
function openApp() {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("participantNav").classList.toggle("hidden", isAdmin);
    document.getElementById("adminNav").classList.toggle("hidden", !isAdmin);
    page(isAdmin ? "admin" : "dashboard");
}

/* =====================================================
   LOGOUT
===================================================== */
function logout(message = null) {
    sessionStorage.clear();
    user = null;
    isAdmin = false;
    stopPolling();
    if (message) {
        alert(message);
    }
    location.reload();
}

/* =====================================================
   PAGE NAVIGATION
===================================================== */
function page(p) {
    if (isAdmin && ["dashboard", "event", "submit"].includes(p)) p = "admin";
    if (!isAdmin && p === "admin") p = "dashboard";
    ["dashboard", "event", "submit", "schedule", "admin"].forEach(
        x => document.getElementById(x).classList.add("hidden")
    );
    document.getElementById(p).classList.remove("hidden");
    
    if (p === 'schedule') {
        if (isAdmin) fetchAdminTeams();
        else fetchPublicSchedule();
    }
    
    render();
    if (p === "submit" && !isAdmin) renderSubmission();
}

/* =====================================================
   FORMAT TIME
===================================================== */
function fmt(v) {
    if (!v) return "Not scheduled";
    const [h, m] = v.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/* =====================================================
   ESCAPE HTML
===================================================== */
function esc(s) {
    return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

/* =====================================================
   REFRESH & POLLING
===================================================== */
async function refreshParticipantDashboard(showToast = true) {
    if (isAdmin || !user) return;
    try {
        const data = await fetchAPI(`/teams/${user.teamId}`);
        
        let oldSchedule = user.start;
        let oldName = user.name;
        let oldEmail = user.email;
        let oldYear = user.year;

        user = data.team;
        sessionStorage.setItem('user', JSON.stringify(user));
        
        if (showToast) {
            if (oldSchedule !== user.start) {
                toast(`✓ Schedule updated. Your presentation starts at ${fmt(user.start)}.`);
            } else if (oldName !== user.name || oldEmail !== user.email || oldYear !== user.year) {
                toast("✓ Your team information has been updated.");
            } else {
                toast("✓ Latest schedule and team information loaded successfully.");
            }
        }
        render();
        renderSubmission();
        fetchPublicSchedule();
    } catch (err) {
        if (err.message === 'Team not found' || err.message.toLowerCase().includes('not found')) {
            logout("⚠ Your team has been deleted by the event admin.");
        } else {
            if(showToast) toast("Failed to refresh: " + err.message);
        }
    }
}

async function fetchPublicSchedule() {
    try {
        const data = await fetchAPI('/participant/schedule');
        teams = data.teams;
        renderSchedule();
    } catch (err) {
        console.error('Schedule fetch error:', err);
    }
}

async function fetchAdminTeams(showToast = false) {
    if (!isAdmin) return;
    try {
        const data = await fetchAPI('/admin/teams');
        teams = data.teams;
        renderAdmin();
        renderSchedule();
        if(showToast) toast("✓ Latest teams loaded successfully.");
    } catch (err) {
        if(showToast) toast("Failed to fetch teams: " + err.message);
    }
}

async function refreshAdminDashboard() {
    fetchAdminTeams(true);
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        if (isAdmin) {
            fetchAdminTeams(false);
        } else if (user) {
            refreshParticipantDashboard(false);
        }
    }, 5000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/* =====================================================
   MAIN RENDER
===================================================== */
function render() {
    if (!isAdmin && user) {
        document.getElementById("welcome").textContent = "Welcome, " + user.name;
        document.getElementById("subtitle").textContent = user.teamId + " · " + user.email + " · " + (user.year || "Year not specified");
        document.getElementById("teamCard").textContent = user.name;
        document.getElementById("yearCard").textContent = user.year || "—";
        document.getElementById("submitTeam").value = user.name;
        document.getElementById("myTime").textContent = user.start ? fmt(user.start) : "Not scheduled";
        
        const s = document.getElementById("status");
        s.textContent = user.paper ? "Submitted" : "Pending";
        s.className = "badge " + (user.paper ? "ok" : "wait");
    }

    renderSchedule();
    if (isAdmin) renderAdmin();
}

/* =====================================================
   RENDER SCHEDULE
===================================================== */
function renderSchedule() {
    const b = document.getElementById("scheduleBody");
    if (!b) return;
    b.innerHTML = [...teams].sort((a,b) => (a.order || 0) - (b.order || 0)).map(t => `
<tr>
    <td>#${String(t.order || 0).padStart(2,"0")}</td>
    <td>${esc(t.teamId)}</td>
    <td><b>${esc(t.name)}</b></td>
    <td>${esc(t.year || "Not specified")}</td>
    <td>${t.start ? fmt(t.start) : "Not scheduled"}</td>
    <td><span class="badge ${t.paper ? "ok" : "wait"}">${t.paper ? "Submitted" : "Pending"}</span></td>
</tr>`).join("");
}

/* =====================================================
   RENDER ADMIN
===================================================== */
function renderAdmin() {
    document.getElementById("teamCount").textContent = teams.length;
    document.getElementById("uploadCount").textContent = teams.filter(t => t.paper).length;
    document.getElementById("scheduledCount").textContent = teams.filter(t => t.start).length;

    const b = document.getElementById("adminBody");
    if (!b) return;
    b.innerHTML = [...teams].sort((a,b) => (a.order || 0) - (b.order || 0)).map(t => `
<tr>
    <td>#${t.order}</td>
    <td><b>${esc(t.name)}</b><br><span class="label">${esc(t.teamId)}</span></td>
    <td>${esc(t.email)}</td>
    <td>${esc(t.year || "Not specified")}</td>
    <td>${t.paper ? esc(t.paper.title || t.paper.originalName) : "Not uploaded"}</td>
    <td><input type="time" value="${t.start || ""}" onchange="changeTime('${t.teamId}', this.value)"></td>
    <td>${t.paper ? `<button class="btn secondary" onclick="downloadPresentation('${t.teamId}')">Download</button>` : "—"}</td>
    <td><button class="btn danger" onclick="deleteTeam('${t.teamId}')">Delete</button></td>
</tr>`).join("");
}

/* =====================================================
   CHANGE PRESENTATION TIME
===================================================== */
async function changeTime(id, start) {
    try {
        await fetchAPI(`/admin/teams/${id}/schedule`, 'PUT', { start });
        toast("Schedule updated successfully.");
        fetchAdminTeams();
    } catch (err) {
        toast("Failed to update schedule");
    }
}

/* =====================================================
   RESET FCFS SCHEDULE
===================================================== */
async function resetSchedule() {
    if (!confirm("Reset the schedule based on registration order?")) return;
    try {
        await fetchAPI('/admin/schedule/reset', 'POST');
        toast("Schedule reset successfully.");
        fetchAdminTeams();
    } catch (err) {
        toast("Failed to reset schedule");
    }
}

/* =====================================================
   PAPER SUBMISSION
===================================================== */
let selectedFile = null;

function fileSelected(input) {
    const f = input.files[0];
    selectedFile = f;
    const l = document.getElementById("fileName");
    if (f) {
        l.textContent = `Selected: ${f.name} (${(f.size / 1048576).toFixed(2)} MB)`;
        if (f.size > 50 * 1024 * 1024) toast("Warning: File exceeds 50MB");
    } else {
        l.textContent = "No file selected";
    }
}

async function submitPaper(e) {
    e.preventDefault();
    if (isAdmin || !user) return;
    const title = document.getElementById("paperTitle").value.trim();
    if (!title) return toast("Enter the paper title.");
    if (!selectedFile && !user.paper) return toast("Select a presentation file.");

    if (selectedFile) {
        if (selectedFile.size > 50 * 1024 * 1024) return toast("Maximum file size is 50 MB.");
        if (!/\.(pdf|ppt|pptx)$/i.test(selectedFile.name)) return toast("Only PDF, PPT, and PPTX files are allowed.");
    }

    try {
        const formData = new FormData();
        formData.append('title', title);
        if (selectedFile) formData.append('file', selectedFile);

        const data = await fetchAPI(`/teams/${user.teamId}/presentation`, 'POST', formData);
        user.paper = data.paper;
        sessionStorage.setItem('user', JSON.stringify(user));
        
        renderSubmission();
        render();
        toast(selectedFile ? "Presentation uploaded successfully." : "Paper title updated successfully.");
        selectedFile = null;
    } catch (error) {
        toast(error.message || "Unable to save the presentation.");
    }
}

function renderSubmission() {
    if (isAdmin || !user) return;
    const current = document.getElementById("currentSubmission");
    const deleteBtn = document.getElementById("deletePresentationBtn");
    const status = document.getElementById("uploadStatus");

    if (user.paper) {
        current.classList.remove("hidden");
        deleteBtn.classList.remove("hidden");
        document.getElementById("currentPaperTitle").textContent = user.paper.title || "Untitled paper";
        document.getElementById("currentPaperFile").textContent = `${user.paper.originalName} · ${(Number(user.paper.size || 0) / 1048576).toFixed(2)} MB`;
        status.classList.remove("hidden");
        status.textContent = "Your presentation is currently submitted. You can edit/replace or delete it.";
    } else {
        current.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        status.classList.add("hidden");
    }
}

function editMyPresentation() {
    if (isAdmin) return toast("Admin cannot edit participant submissions.");
    if (!user) return;
    document.getElementById("paperTitle").value = user.paper?.title || "";
    document.getElementById("paperFile").value = "";
    selectedFile = null;
    document.getElementById("fileName").textContent = user.paper ? `Current file: ${user.paper.originalName} (choose a new file to replace it)` : "No file selected";
    document.getElementById("paperTitle").focus();
    toast("Edit mode enabled. Choose a new file to replace the current presentation.");
}

async function deleteMyPresentation() {
    if (isAdmin) return toast("Admin cannot delete participant submissions from this page.");
    if (!user || !user.paper) return toast("You do not have an uploaded presentation.");
    if (!confirm(`Delete your uploaded presentation?\n\nTeam: ${user.name}\nFile: ${user.paper.originalName}\n\nThis will permanently remove the uploaded presentation.`)) return;

    try {
        await fetchAPI(`/teams/${user.teamId}/presentation`, 'DELETE');
        user.paper = null;
        sessionStorage.setItem('user', JSON.stringify(user));
        
        document.getElementById("paperTitle").value = "";
        document.getElementById("paperFile").value = "";
        selectedFile = null;
        document.getElementById("fileName").textContent = "No file selected";
        
        renderSubmission();
        render();
        toast("Your presentation was deleted.");
    } catch (error) {
        toast("Unable to delete the presentation.");
    }
}

/* =====================================================
   ADMIN DOWNLOAD
===================================================== */
function downloadPresentation(id) {
    const token = sessionStorage.getItem('token');
    if (!token) return;
    toast("Starting download...");
    fetch(`${API_URL}/admin/teams/${id}/presentation/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error("Could not download file.");
        const disposition = res.headers.get('Content-Disposition');
        let filename = "presentation";
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const matches = /filename="([^"]+)"/.exec(disposition);
            if (matches != null && matches[1]) filename = matches[1];
        }
        return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => toast(err.message));
}

/* =====================================================
   DELETE INDIVIDUAL TEAM
===================================================== */
async function deleteTeam(id) {
    if (!confirm(`Delete team?\n\nThis will remove the team and its uploaded presentation.`)) return;
    try {
        await fetchAPI(`/admin/teams/${id}`, 'DELETE');
        toast("Team deleted successfully.");
        fetchAdminTeams();
    } catch (error) {
        toast("Unable to delete team.");
    }
}

/* =====================================================
   DELETE ALL TEAMS
===================================================== */
async function deleteAllTeams() {
    if (!teams.length) return toast("There are no entered teams.");
    if (!confirm(`Delete ALL ${teams.length} teams and their presentation files?`)) return;
    if (!confirm("FINAL CONFIRMATION: This will permanently clear every team and uploaded presentation. Continue?")) return;

    try {
        await fetchAPI('/admin/teams', 'DELETE');
        toast("All teams and presentations deleted. Site is fresh.");
        fetchAdminTeams();
    } catch (error) {
        toast("Unable to completely clear presentations.");
    }
}

// Initialize on page load
initApp();
