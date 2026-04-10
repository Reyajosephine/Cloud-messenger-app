// ==========================================
// Backend API URL
// Replace this with your deployed Vercel or Render backend URL
// Example: const API_URL = "https://your-backend-url.onrender.com";
// If using Vercel, use your project URL:
// https://your-project-name.vercel.app
// ==========================================
const API_URL = "https://cloud-messenger-app.vercel.app/";

// ==========================================
// Supabase project settings
// 1) Create a Supabase project
// 2) Enable Email auth in Authentication settings
// 3) Paste project URL + anon key below
// ==========================================
const SUPABASE_URL = "https://dcnbrtalpjojepwfocou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbmJydGFscGpvamVwd2ZvY291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzMwMTgsImV4cCI6MjA5MTM0OTAxOH0.Rmfk6MskIeCqC4P_dSd-Ut_3RsCjvnALXi6Gn4MT2UE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get elements from the page
const usernameInput = document.getElementById("usernameInput");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatBox = document.getElementById("chatBox");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const signUpButton = document.getElementById("signUpButton");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");

// Keep track of the last render to avoid unnecessary re-rendering
let lastRenderedJson = "";
let pollIntervalId = null;
let currentUser = null;

// Convert timestamp to readable local time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Render all messages in the chat window
function renderMessages(messages) {
  const username = usernameInput.value.trim();
  const nextJson = JSON.stringify(messages);

  // Skip if no changes since last render
  if (nextJson === lastRenderedJson) {
    return;
  }

  chatBox.innerHTML = "";

  messages.forEach((msg) => {
    const bubble = document.createElement("div");
    const isSelf = username && msg.username === username;

    bubble.className = `message ${isSelf ? "self" : "other"}`;

    bubble.innerHTML = `
      <div class="meta">${msg.username} • ${formatTime(msg.timestamp)}</div>
      <div class="text">${msg.text}</div>
    `;

    chatBox.appendChild(bubble);
  });

  // Always scroll to bottom after rendering
  chatBox.scrollTop = chatBox.scrollHeight;
  lastRenderedJson = nextJson;
}

// Enable or disable chat actions based on login status
function setChatEnabled(enabled) {
  usernameInput.disabled = !enabled;
  messageInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

// Build a localStorage key per logged in user
function displayNameStorageKey() {
  return currentUser ? `display_name_${currentUser.id}` : "";
}

// Fill display name from local storage or email prefix
function hydrateDisplayName() {
  if (!currentUser) {
    usernameInput.value = "";
    return;
  }

  const key = displayNameStorageKey();
  const savedName = key ? localStorage.getItem(key) : "";
  if (savedName) {
    usernameInput.value = savedName;
    return;
  }

  const email = currentUser.email || "";
  const emailPrefix = email.includes("@") ? email.split("@")[0] : "User";
  usernameInput.value = emailPrefix;
}

// Save display name whenever user changes it
usernameInput.addEventListener("input", () => {
  const key = displayNameStorageKey();
  if (!key) {
    return;
  }
  localStorage.setItem(key, usernameInput.value.trim());
});

// Return auth headers with current access token
async function getAuthHeaders() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session || !session.access_token) {
    throw new Error("No active session");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };
}

// GET /messages
async function fetchMessages() {
  try {
    if (!currentUser) {
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/messages`, { headers });

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    const messages = await response.json();
    renderMessages(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
  }
}

// POST /messages
async function sendMessage() {
  const username = usernameInput.value.trim();
  const text = messageInput.value.trim();

  if (!currentUser) {
    alert("Please login first.");
    return;
  }

  if (!username) {
    alert("Please enter a display name first.");
    return;
  }

  if (!text) {
    return;
  }

  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, text })
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    // Clear input and refresh chat
    messageInput.value = "";
    await fetchMessages();
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Signup with email and password
async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    return;
  }

  alert("Signup successful. If email confirmation is enabled, verify email and then login.");
}

// Login with email and password
async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
  }
}

// Logout current user
async function logout() {
  await supabaseClient.auth.signOut();
}

// Update UI after auth state changes
async function refreshAuthUI() {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  currentUser = user || null;

  if (!currentUser) {
    authStatus.textContent = "Not logged in";
    setChatEnabled(false);
    chatBox.innerHTML = "";
    lastRenderedJson = "";
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    return;
  }

  authStatus.textContent = `Logged in as ${currentUser.email}`;
  setChatEnabled(true);
  hydrateDisplayName();
  await fetchMessages();

  if (!pollIntervalId) {
    pollIntervalId = setInterval(fetchMessages, 2000);
  }
}

// Send button click
sendButton.addEventListener("click", sendMessage);
signUpButton.addEventListener("click", signUp);
loginButton.addEventListener("click", login);
logoutButton.addEventListener("click", logout);

// Allow Enter key to send message
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

// React to auth changes
supabaseClient.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

// Initial load
refreshAuthUI();
