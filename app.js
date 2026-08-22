const supabaseClient = window.supabase.createClient(COFAP_CONFIG.url, COFAP_CONFIG.publishableKey);
const POINTS = { academic: 4, fitness: 3, misc: 2 };
const TYPE_LABELS = { academic: 'Academic', fitness: 'Fitness', misc: 'Miscellaneous' };
const TYPE_ICONS = { academic: 'graduation-cap', fitness: 'dumbbell', misc: 'sparkles' };
const DATA_VERSION = 2;
const defaultMembers = [
  { name: 'AARYAN SACHDEVA', initials: 'AS', points: 0, type: 'you', color: '#ff765f' },
  { name: 'ADITYA KUMAR SINGH', initials: 'AK', points: 0, type: 'member', color: '#8ed8db' },
  { name: 'ABHISHEK SHARMA', initials: 'AS', points: 0, type: 'member', color: '#d8f06a' },
  { name: 'KUSHAGRA BHARDWAJ', initials: 'KB', points: 0, type: 'member', color: '#c7b7ff' },
  { name: 'MADHAV TIWARI', initials: 'MT', points: 0, type: 'member', color: '#f1bb71' },
  { name: 'KRISHNA GUPTA', initials: 'KG', points: 0, type: 'member', color: '#e5a8c4' }
];
if (localStorage.getItem('cofap-data-version') !== String(DATA_VERSION)) {
  localStorage.setItem('cofap-members', JSON.stringify(defaultMembers));
  localStorage.setItem('cofap-activities', JSON.stringify([]));
  localStorage.setItem('cofap-data-version', String(DATA_VERSION));
}
let members = JSON.parse(localStorage.getItem('cofap-members')) || defaultMembers;
let activeCategory = 'academic';
let activities = JSON.parse(localStorage.getItem('cofap-activities')) || [];
const $ = (selector) => document.querySelector(selector);
let authMode = 'sign-in';
function setAuthMessage(message, isError = false) { const messageElement = $('#auth-message'); messageElement.textContent = message; messageElement.classList.toggle('error', isError); }
function setAuthMode(mode) { authMode = mode; const isSignIn = mode === 'sign-in'; $('#auth-title').textContent = isSignIn ? 'Sign in' : 'Create account'; $('#auth-subtitle').textContent = isSignIn ? 'Your progress lives here.' : 'Start your first FAP week.'; $('#auth-submit').innerHTML = `${isSignIn ? 'Sign in' : 'Create account'} <i data-lucide="arrow-right"></i>`; $('#auth-switch').innerHTML = isSignIn ? 'New to COFAP? <button type="button">Create an account</button>' : 'Already a member? <button type="button">Sign in</button>'; $('#auth-switch button').addEventListener('click', () => setAuthMode(isSignIn ? 'sign-up' : 'sign-in')); lucide.createIcons(); }
async function handleAuth(event) { event.preventDefault(); const email = $('#auth-email').value.trim(); const password = $('#auth-password').value; setAuthMessage('Connecting to COFAP...'); const redirectUrl = `${window.location.origin}${window.location.pathname}`; const result = authMode === 'sign-in' ? await supabaseClient.auth.signInWithPassword({ email, password }) : await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl } }); if (result.error) { setAuthMessage(result.error.message, true); return; } if (authMode === 'sign-up' && !result.data.session) { setAuthMessage('Account created. Check your email to confirm it, then sign in.'); return; } setAuthMessage(''); showApp(); }
function showApp() { $('#auth-screen').classList.add('hidden'); document.querySelector('.app-shell').classList.remove('hidden'); }
function showAuth() { $('#auth-screen').classList.remove('hidden'); document.querySelector('.app-shell').classList.add('hidden'); }
async function createTeam(event) { event.preventDefault(); const name = $('#team-name').value.trim(); if (!name) return; const { data, error } = await supabaseClient.rpc('create_cofap_team', { team_name: name }); if (error) { showToast(error.message); return; } $('#team-name').value = ''; $('#team-status').textContent = `${data[0].name} · key ${data[0].invite_code}`; showToast('Team created. Copy the key to invite friends.'); }
async function joinTeam(event) { event.preventDefault(); const inviteCode = $('#team-key').value.trim().toUpperCase(); if (!inviteCode) return; const { data, error } = await supabaseClient.rpc('join_cofap_team', { invite_code_input: inviteCode }); if (error) { showToast(error.message); return; } $('#team-key').value = ''; $('#team-status').textContent = `${data[0].name} · joined`; showToast('You joined the team.'); }
$('#auth-form').addEventListener('submit', handleAuth);
$('#sign-out').addEventListener('click', async () => { await supabaseClient.auth.signOut(); showAuth(); });
$('#create-team-form').addEventListener('submit', createTeam);
$('#join-team-form').addEventListener('submit', joinTeam);
setAuthMode('sign-in');
supabaseClient.auth.getSession().then(({ data }) => data.session ? showApp() : showAuth());
supabaseClient.auth.onAuthStateChange((_event, session) => session ? showApp() : showAuth());
const dateInput = $('#activity-date');
function updateDateTime() {
  const now = new Date();
  dateInput.value = now.toISOString().slice(0, 10);
  $('#current-datetime').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
}
updateDateTime();
setInterval(updateDateTime, 1000);

function tierFor(points) {
  if (points >= 60) return 'Platinum';
  if (points >= 50) return 'Gold';
  if (points >= 40) return 'Silver';
  if (points >= 30) return 'Bronze';
  return 'Unranked';
}
function renderDashboard() {
  const personalPoints = members[0].points + activities.reduce((sum, activity) => sum + activity.points, 0);
  const tier = tierFor(personalPoints);
  const progress = Math.min(personalPoints / 60, 1);
  $('#hero-score').innerHTML = `${personalPoints} <small>/ 60 pts</small>`;
  $('#hero-message').textContent = personalPoints >= 60 ? 'Platinum unlocked. Keep the standard high.' : `${60 - personalPoints} more points to reach Platinum.`;
  $('#tier-badge').textContent = tier.toUpperCase();
  $('#ring-label').textContent = `${Math.round(progress * 100)}%`;
  $('#ring-progress').style.strokeDashoffset = 320 - (320 * progress);
  const streak = Math.min(activities.length, 7);
  $('#streak-number').textContent = String(streak).padStart(2, '0');
  $('#streak-dots').innerHTML = Array.from({ length: 7 }, (_, index) => `<span class="${index < streak ? 'done' : ''}"></span>`).join('');
  renderActivities();
  renderLeaderboard(personalPoints);
  $('#member-count').textContent = String(members.length).padStart(2, '0');
  lucide.createIcons();
}
function renderActivities() {
  const list = $('#activity-list');
  if (!activities.length) { list.innerHTML = '<div class="empty-state">No activity logged yet. Start your week here.</div>'; return; }
  list.innerHTML = activities.slice(0, 5).map((activity) => `<div class="activity-entry"><span class="entry-icon ${activity.category}"><i data-lucide="${TYPE_ICONS[activity.category]}"></i></span><span><b>${escapeHtml(activity.name)}</b><small>${TYPE_LABELS[activity.category]} · ${formatDate(activity.date)}</small></span><span class="entry-points">+${activity.points} pts</span></div>`).join('');
}
function renderLeaderboard(personalPoints) {
  const rows = members.map((member, index) => ({ ...member, points: member.type === 'you' ? personalPoints : member.points })).sort((a, b) => b.points - a.points);
  $('#leaderboard-list').innerHTML = rows.map((member, index) => { const tier = tierFor(member.points); return `<div class="leader-row ${member.type === 'you' ? 'you' : ''}"><span class="rank">0${index + 1}</span><span class="member"><span class="avatar" style="background:${member.color}">${member.initials}</span><span><b>${member.name}${member.type === 'you' ? ' (you)' : ''}</b><small>${member.type === 'you' ? 'Your current position' : 'COFAP member'}</small></span></span><span class="points">${member.points} <small>pts</small></span><span class="status ${tier.toLowerCase()}">${tier.toUpperCase()}</span></div>`; }).join('');
}
function formatDate(date) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function escapeHtml(text) { const element = document.createElement('div'); element.textContent = text; return element.innerHTML; }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }

document.querySelectorAll('.category-tab').forEach((tab) => tab.addEventListener('click', () => { activeCategory = tab.dataset.category; document.querySelectorAll('.category-tab').forEach((item) => item.classList.toggle('active', item === tab)); }));
$('#activity-form').addEventListener('submit', (event) => { event.preventDefault(); const name = $('#activity-name').value.trim(); if (!name) return; activities.unshift({ name, category: activeCategory, date: dateInput.value, points: POINTS[activeCategory] }); localStorage.setItem('cofap-activities', JSON.stringify(activities)); $('#activity-name').value = ''; renderDashboard(); showToast(`+${POINTS[activeCategory]} FAP points added`); });
$('#clear-activity').addEventListener('click', () => { if (!activities.length) return; activities = []; localStorage.setItem('cofap-activities', JSON.stringify(activities)); renderDashboard(); showToast('Recent activity cleared'); });
$('#member-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#member-name').value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!name) return;
  if (members.some((member) => member.name === name)) { showToast('That member is already on the roster'); return; }
  const nameParts = name.split(' ');
  members.push({ name, initials: `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`, points: 0, type: 'member', color: '#b9c6a8' });
  localStorage.setItem('cofap-members', JSON.stringify(members));
  $('#member-name').value = '';
  renderDashboard();
  showToast(`${name} added to COFAP`);
});
renderDashboard();
