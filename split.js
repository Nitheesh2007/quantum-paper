const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(filePath, 'utf-8');

const cssStart = content.indexOf('<style>') + 7;
const cssEnd = content.indexOf('</style>');
const css = content.slice(cssStart, cssEnd).trim();
fs.writeFileSync(path.join(__dirname, 'public/style.css'), css);

const bodyStart = content.indexOf('<body>') + 6;
const bodyEnd = content.indexOf('<script>');
let htmlBody = content.slice(bodyStart, bodyEnd).trim();

// Add Refresh buttons to Participant Dashboard and Admin Dashboard
// Let's replace the participant dashboard hero actions div
htmlBody = htmlBody.replace(
    /<div class="actions">[\s\S]*?<button[\s\S]*?Upload Presentation[\s\S]*?<\/button>[\s\S]*?<button[\s\S]*?View Schedule[\s\S]*?<\/button>[\s\S]*?<\/div>/,
    `<div class="actions">
        <button class="btn" onclick="page('submit')">Upload Presentation</button>
        <button class="btn secondary" onclick="page('schedule')">View Schedule</button>
        <button class="btn" style="background: linear-gradient(135deg, #35d39a, #28a745);" onclick="refreshParticipantDashboard()">↻ Refresh Dashboard</button>
    </div>`
);

// Add Refresh button to Admin Dashboard topline
htmlBody = htmlBody.replace(
    /<button[\s\S]*?class="btn danger"[\s\S]*?onclick="deleteAllTeams\(\)"[\s\S]*?>[\s\S]*?Delete All Teams[\s\S]*?<\/button>/,
    `<button class="btn" style="background: linear-gradient(135deg, #35d39a, #28a745);" onclick="refreshAdminDashboard()">↻ Refresh</button>
    <button class="btn danger" onclick="deleteAllTeams()">Delete All Teams</button>`
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Quantum Fest 2K26 | Paper Presentation</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
${htmlBody}
<script src="app.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'public/index.html'), html);
console.log('Split index.html successfully!');
