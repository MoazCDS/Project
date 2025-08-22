const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let step = 0;
let userData = {};

const questions = [
  "Great! What are your top 3 skills?",
  "What kind of work environment do you prefer? (e.g., remote, office, hybrid)",
  "Do you have any specific job titles in mind?",
  "What's your highest level of education?",
  "Thanks! Based on your answers, I’ll suggest some job roles shortly."
];

sendBtn.addEventListener("click", () => {
  const input = userInput.value.trim();
  if (!input) return;

  addMessage("user", input);
  userInput.value = "";

  switch (step) {
    case 0:
      userData.name = input;
      nextQuestion();
      break;
    case 1:
      userData.skills = input;
      nextQuestion();
      break;
    case 2:
      userData.environment = input;
      nextQuestion();
      break;
    case 3:
      userData.jobTitles = input;
      nextQuestion();
      break;
    case 4:
      userData.education = input;
      showSuggestions();
      break;
  }
});

function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function nextQuestion() {
  step++;
  setTimeout(() => addMessage("bot", questions[step]), 500);
}

function showSuggestions() {
  setTimeout(() => {
    addMessage("bot", `Thanks ${userData.name}! Based on your skills in ${userData.skills} and your preference for ${userData.environment} work, here are some roles you might like:`);
    addMessage("bot", `- ${userData.jobTitles || "Software Developer"}\n- Data Analyst\n- Project Coordinator`);
  }, 1000);
}