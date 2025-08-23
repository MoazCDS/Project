'use strict';

// ========= Local Storage Utilities =========
const LS_USERS_KEY = 'jm_users';
const LS_CURRENT_USER_KEY = 'jm_current_user';
const THEME_KEY = 'jm_theme';

function getUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS_KEY)) || []; }
  catch { return []; }
}
function saveUsers(users) { localStorage.setItem(LS_USERS_KEY, JSON.stringify(users)); }
function setCurrentUser(user) { localStorage.setItem(LS_CURRENT_USER_KEY, JSON.stringify(user)); }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem(LS_CURRENT_USER_KEY)); } catch { return null; } }
function clearCurrentUser() { localStorage.removeItem(LS_CURRENT_USER_KEY); }

// ========= Theme Management =========
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const themeSwitch = document.getElementById('themeSwitch');
  if (themeSwitch) {
    themeSwitch.checked = savedTheme === 'dark';
    themeSwitch.addEventListener('change', toggleTheme);
  }
}

function toggleTheme(e) {
  const isDark = e.target.checked;
  const theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

// ========= Auth Guard & Navbar State =========
function enforceAuth() {
  const current = location.pathname.split('/').pop() || 'index.html';
  const publicPages = ['signin.html', 'signup.html'];
  const loggedIn = !!getCurrentUser();

  if (!loggedIn && !publicPages.includes(current)) {
    const redirect = encodeURIComponent(current);
    window.location.replace(`signin.html?redirect=${redirect}`);
    return;
  }
  if (loggedIn && publicPages.includes(current)) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || 'index.html';
    window.location.replace(redirect);
  }
}

function initAuthUI() {
  const authLinks = document.getElementById('authLinks');
  const userSection = document.getElementById('userSection');
  const userName = document.getElementById('userName');
  const logoutBtn = document.getElementById('logoutBtn');
  const user = getCurrentUser();

  // Update UI based on auth state
  if (user) {
    if (authLinks) authLinks.style.display = 'none';
    if (userSection) userSection.style.display = 'flex';
    if (userName) userName.textContent = `Hi, ${user.name || 'User'}`; userName.style.color = 'white';

    // Initialize theme after auth UI is set up
    initTheme();

    // Add logout handler
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearCurrentUser();
        window.location.href = 'signin.html';
      });
    }
  } else {
    if (authLinks) authLinks.style.display = 'block';
    if (userSection) userSection.style.display = 'none';
  }
}

function highlightActiveLink() {
  const links = document.querySelectorAll('.nav-links a[href]');
  const current = location.pathname.split('/').pop() || 'index.html';
  links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === current));
}

// ========= Signup / Signin =========
function initSignup() {
  const form = document.getElementById('signupForm');
  if (!form) return;
  const result = document.getElementById('signupResult');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim().toLowerCase();
    const password = document.getElementById('password')?.value;

    if (!name || !email || !password) {
      if (result) result.textContent = 'Please fill all fields.';
      return;
    }
    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      if (result) result.textContent = 'Email already registered. Try signing in.';
      return;
    }
    const newUser = { name, email, password };
    users.push(newUser);
    saveUsers(users);
    setCurrentUser({ name, email });

    if (result) result.textContent = 'Account created! Redirecting...';
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || 'index.html';
    setTimeout(() => (window.location.href = redirect), 700);
  });
}

function initSignin() {
  const form = document.getElementById('signinForm');
  if (!form) return;
  const result = document.getElementById('signinResult');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value;

    const users = getUsers();
    const match = users.find((u) => u.email === email && u.password === password);

    if (!match) {
      if (result) result.textContent = 'Invalid credentials. Please try again.';
      return;
    }
    setCurrentUser({ name: match.name, email: match.email });
    if (result) result.textContent = 'Signed in! Redirecting...';
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || 'index.html';
    setTimeout(() => (window.location.href = redirect), 600);
  });
}

// ========= CV Builder: Robust PDF =========
function getJsPDFConstructor() {
  return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
}
function safeRoundedRect(doc, x, y, w, h, rx, ry, style) {
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(x, y, w, h, rx, ry, style);
  } else {
    doc.rect(x, y, w, h, style);
  }
}
function makeSectionHeader(doc, text, y, pageW, margin) {
  doc.setFillColor(230, 238, 255);
  safeRoundedRect(doc, margin, y, pageW - margin * 2, 8, 2, 2, 'F');
  doc.setTextColor(10, 62, 130);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(text, margin + 3, y + 6);
  doc.setTextColor(0, 0, 0);
  return y + 12;
}
function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}
function ensurePageSpace(doc, y, minSpace, margin) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + minSpace > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}
function initCVBuilder() {
  const form = document.getElementById('cvForm');
  if (!form) return;
  const result = document.getElementById('cvResult');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('cvName')?.value.trim();
    const contact = document.getElementById('cvContact')?.value.trim();
    const summary = document.getElementById('cvSummary')?.value.trim();
    const skills = document.getElementById('cvSkills')?.value.trim();
    const exp = document.getElementById('cvExperience')?.value.trim();
    const edu = document.getElementById('cvEducation')?.value.trim();

    if (!name || !contact || !skills || !exp || !edu) {
      if (result) result.textContent = 'Please complete all required fields.';
      return;
    }

    const JsPDFCtor = getJsPDFConstructor();
    if (!JsPDFCtor) {
      if (result) result.textContent = 'PDF library failed to load. Check your internet and try again.';
      return;
    }

    try {
      const doc = new JsPDFCtor('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;

      // Header banner
      doc.setFillColor(10, 110, 253);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(name, margin, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(contact, margin, 24);
      doc.setTextColor(0, 0, 0);

      y = 34;

      // --- Professional Summary ---
      if (summary) {
        y = makeSectionHeader(doc, 'Professional Summary', y, pageW, margin);
        y = ensurePageSpace(doc, y, 12, margin);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        const indent = margin + 5;
        y = addWrappedText(doc, summary, indent, y, pageW - indent - margin, 6);
        y += 2;
      }

      // --- Skills in two columns ---
      y = makeSectionHeader(doc, 'Skills', y, pageW, margin);
      y = ensurePageSpace(doc, y, 12, margin);
      const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
      const maxWidth = pageW - margin * 2;
      const colW = maxWidth / 2;
      const leftX = margin + 5;  // indent skills content
      const rightX = margin + colW + 5; // indent right column too
      let leftY = y, rightY = y;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);

      skillList.forEach((s, i) => {
        const bullet = `• ${s}`;
        if (i % 2 === 0) {
          leftY = ensurePageSpace(doc, leftY, 8, margin);
          doc.text(bullet, leftX, leftY);
          leftY += 6;
        } else {
          rightY = ensurePageSpace(doc, rightY, 8, margin);
          doc.text(bullet, rightX, rightY);
          rightY += 6;
        }
      });
      y = Math.max(leftY, rightY) + 2;

      // --- Experience ---
      y = ensurePageSpace(doc, y, 20, margin);
      y = makeSectionHeader(doc, 'Experience', y, pageW, margin);
      y = ensurePageSpace(doc, y, 12, margin);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      const expLines = exp.split('\n').map(line => line.trim()).filter(Boolean);
      expLines.forEach(line => {
        y = ensurePageSpace(doc, y, 8, margin);
        if (line.startsWith('-')) {
          y = addWrappedText(doc, `• ${line.substring(1).trim()}`, margin + 5, y, pageW - (margin + 5) - margin, 6);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.text(line, margin + 5, y); // indent even bold headings in Experience
          doc.setFont('helvetica', 'normal');
          y += 6;
        }
      });
      y += 2;

      // --- Education ---
      y = ensurePageSpace(doc, y, 18, margin);
      y = makeSectionHeader(doc, 'Education', y, pageW, margin);
      y = ensurePageSpace(doc, y, 12, margin);
      const eduLines = edu.split('\n').map(line => line.trim()).filter(Boolean);
      eduLines.forEach(line => {
        y = ensurePageSpace(doc, y, 8, margin);
        y = addWrappedText(doc, line, margin + 5, y, pageW - (margin + 5) - margin, 6);
      });

      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Generated with JobMate AI', margin, pageH - 7);

      doc.save(`${name.replace(/\s+/g, '_')}_Resume.pdf`);
      if (result) {
          result.textContent = 'PDF generated. Check your downloads.'
          result.style.display = 'block';
          result.style.color = 'black';
      }
    } catch (err) {
      if (result) result.textContent = 'Unexpected error while generating PDF. Try again.';
      console.error(err);
    }
  });
}

// ========= Job Matcher (demo) =========
function initJobMatcher() {
  const form = document.getElementById('jobForm');
  if (!form) return;
  const results = document.getElementById('jobResults');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (document.getElementById('jobSkills')?.value || '').toLowerCase();
    if (!text) return;

    const suggestions = [];
    if (/\b(?:js|javascript|react|node|frontend|html|css)\b/.test(text)) {
      suggestions.push('Front-End Developer (React)', 'JavaScript Engineer', 'Full-Stack Developer (Node/React)');
    }
    if (/\b(?:python|pandas|numpy|data|ml|ai|analysis|sql|tableau|power\s?bi)\b/.test(text)) {
      suggestions.push('Data Analyst (Python/SQL)', 'Machine Learning Intern', 'Business Intelligence Analyst');
    }
    if (/\b(?:figma|ui|ux|design|photoshop|illustrator)\b/.test(text)) {
      suggestions.push('UI/UX Designer', 'Product Designer (Junior)', 'Visual Designer');
    }
    if (/\b(?:support|helpdesk|troubleshoot|it support|desktop)\b/.test(text)) {
      suggestions.push('IT Support Specialist', 'Service Desk Analyst', 'Technical Support Associate');
    }
    if (suggestions.length === 0) {
      suggestions.push('Associate — Generalist Role', 'Junior Operations Assistant', 'Trainee — Cross Functional');
    }
    results.innerHTML = `<ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`;
  });
}

// ========= Courses with Clickable Links =========
function initCourses() {
  const form = document.getElementById('courseForm');
  if (!form) return;
  const results = document.getElementById('courseResults');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('courseTopic')?.value.trim();
    if (!topic) return;

    const providers = [
      { name: 'Coursera', url: (t) => `https://www.coursera.org/search?query=${encodeURIComponent(t)}` },
      { name: 'Udemy', url: (t) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(t)}` },
      { name: 'edX', url: (t) => `https://www.edx.org/search?q=${encodeURIComponent(t)}` },
      { name: 'freeCodeCamp', url: () => `https://www.freecodecamp.org/learn/` },
      { name: 'YouTube', url: (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}` },
      { name: 'LinkedIn Learning', url: (t) => `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(t)}` }
    ];

    const items = providers.map(p => {
      const href = p.url(topic);
      return `<li><a href="${href}" target="_blank" rel="noopener">${p.name} — ${topic}</a></li>`;
    }).join('');

    results.innerHTML = `<ul>${items}</ul>`;
  });
}

// ========= Interview Chat =========
const QUESTIONS = [
  'Tell me about yourself.',
  'Describe a challenging project and your impact.',
  'Why do you want this role?',
  'Tell me about a time you worked in a team.',
  'What is your biggest strength?'
];

function addMessage(containerId, text, who = 'bot') {
  const box = document.getElementById(containerId);
  if (!box) return;
  const msg = document.createElement('div');
  msg.className = `message ${who}`;
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function initInterview() {
  const messages = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  const send = document.getElementById('sendBtn');
  const newQ = document.getElementById('newQuestionBtn');
  if (!messages || !input || !send || !newQ) return;

  function askNewQuestion() {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    addMessage('chatMessages', q, 'bot');
  }

  send.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    addMessage('chatMessages', text, 'user');
    input.value = '';

    const feedback = [];
    if (!/result|impact|improved|increased|reduced|saved|grew|cut/i.test(text)) {
      feedback.push('Quantify impact (numbers, % or outcomes).');
    }
    if (!/situation|task|action|result/i.test(text)) {
      feedback.push('Use STAR: Situation, Task, Action, Result.');
    }
    addMessage('chatMessages', feedback.length ? feedback.join(' ') : 'Nice! Clear structure and impact.', 'bot');
  });

  newQ.addEventListener('click', askNewQuestion);
  askNewQuestion();
}

// ========= Skill Finder (How to Find a Job) =========
const FIT_QUESTIONS = [
  { id: 'enjoy', text: 'What tasks do you enjoy at work? (e.g., building websites, analyzing data, designing visuals)' },
  { id: 'tools', text: 'Which tools/tech do you know? (e.g., HTML, Python, Excel, Photoshop, Figma)' },
  { id: 'strengths', text: 'Your top strengths? (e.g., problem-solving, communication, detail-oriented, creativity)' },
  { id: 'industry', text: 'Which industries interest you? (e.g., fintech, healthcare, education, e-commerce)' }
];

function scoreRoles(text) {
  const t = (text || '').toLowerCase();
  const score = {
    'Front-End Developer': 0,
    'Full-Stack Developer': 0,
    'Data Analyst': 0,
    'Data Scientist (Junior)': 0,
    'UI/UX Designer': 0,
    'Digital Marketer': 0,
    'IT Support Specialist': 0,
    'Product Manager (Junior)': 0
  };
  const add = (role, n = 1) => { score[role] += n; };

  // Web
  if (/\b(?:html|css|javascript|js|react|vue|angular|frontend|build(?:ing)? websites)\b/.test(t)) add('Front-End Developer', 2);
  if (/\b(?:node|express|api|backend|full(?:-| )?stack)\b/.test(t)) add('Full-Stack Developer', 2);

  // Data
  if (/\b(?:python|pandas|numpy|sql|excel|tableau|power ?bi|data|analysis|analyz(?:e|ing))\b/.test(t)) add('Data Analyst', 2);
  if (/\b(?:machine learning|ml|scikit|tensorflow|pytorch|model|predict)\b/.test(t)) add('Data Scientist (Junior)', 2);

  // Design
  if (/\b(?:ui|ux|figma|photoshop|illustrator|wireframe|prototype|design)\b/.test(t)) add('UI/UX Designer', 2);

  // Marketing
  if (/\b(?:seo|content|social|ads|marketing|campaign|copy)\b/.test(t)) add('Digital Marketer', 2);

  // IT Support
  if (/\b(?:troubleshoot|tickets|helpdesk|support|hardware|software)\b/.test(t)) add('IT Support Specialist', 2);

  // PM
  if (/\b(?:roadmap|stakeholder|requirement|user story|backlog|ownership)\b/.test(t)) add('Product Manager (Junior)', 2);

  return score;
}

function bestRolesFromScores(scores) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = entries[0][1];
  return entries.filter(([_, v]) => v === topScore && v > 0).map(([k]) => k);
}

function initFitChat() {
  const box = document.getElementById('fitMessages');
  const input = document.getElementById('fitInput');
  const send = document.getElementById('fitSendBtn');
  const restart = document.getElementById('fitRestartBtn');
  const results = document.getElementById('fitResults');
  if (!box || !input || !send || !restart) return;

  let step = 0;
  const answers = {};
  let aggScores = {
    'Front-End Developer': 0,
    'Full-Stack Developer': 0,
    'Data Analyst': 0,
    'Data Scientist (Junior)': 0,
    'UI/UX Designer': 0,
    'Digital Marketer': 0,
    'IT Support Specialist': 0,
    'Product Manager (Junior)': 0
  };

  function postBot(text) { addMessage('fitMessages', text, 'bot'); }
  function postUser(text) { addMessage('fitMessages', text, 'user'); }

  function askCurrent() {
    if (step < FIT_QUESTIONS.length) {
      postBot(FIT_QUESTIONS[step].text);
    } else {
      // Final scoring using all answers, merged with per-step scores
      const allText = Object.values(answers).join(' ');
      const finalScores = scoreRoles(allText);
      Object.keys(finalScores).forEach(k => finalScores[k] += aggScores[k]);

      let topRoles = bestRolesFromScores(finalScores);
      if (topRoles.length === 0) topRoles = ['Generalist Trainee']; // Fallback

      // Show results
      results.style.display = 'block';
      results.innerHTML = `<strong>Recommended role${topRoles.length > 1 ? 's' : ''}:</strong>
        <ul>${topRoles.map(r => `<li>${r}</li>`).join('')}</ul>`;

      // Announce in chat as well
      postBot(`Based on your answers, ${topRoles.length > 1 ? 'these roles' : 'this role'} could be a great fit: ${topRoles.join(', ')}.`);
    }
  }

  function reset() {
    box.innerHTML = '';
    results.style.display = 'none';
    step = 0;
    Object.keys(answers).forEach(k => delete answers[k]);
    Object.keys(aggScores).forEach(k => aggScores[k] = 0);
    postBot("Hi! I'll ask a few quick questions to learn your skills and preferences.");
    askCurrent();
  }

  send.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    postUser(text);

    // Save answer and live-score
    const q = FIT_QUESTIONS[step];
    answers[q.id] = text;
    const s = scoreRoles(text);
    Object.keys(s).forEach(k => aggScores[k] += s[k]);

    input.value = '';
    step += 1;
    askCurrent();
  });

  restart.addEventListener('click', reset);
  reset();
}

// ========= Bootstrap all =========
document.addEventListener('DOMContentLoaded', () => {
  enforceAuth();
  initAuthUI();
  highlightActiveLink();
  initSignup();
  initSignin();
  initCVBuilder();
  initJobMatcher();
  initCourses();
  initInterview();
  initFitChat();
});