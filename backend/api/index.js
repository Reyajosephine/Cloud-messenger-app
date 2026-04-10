// ==========================================
// Simple Messenger Backend (Vercel Serverless)
// Stack: Node.js + Express + CORS + Supabase
// ==========================================

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// Required environment variables in Vercel project settings
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Middleware to authenticate user with Supabase access token
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  return next();
}

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// GET /messages -> return only current user's messages
app.get("/messages", requireUser, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, username, text, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const normalized = (data || []).map((row) => ({
    id: row.id,
    username: row.username,
    text: row.text,
    timestamp: row.created_at
  }));

  return res.status(200).json(normalized);
});

// POST /messages -> add message for current user only
app.post("/messages", requireUser, async (req, res) => {
  const { username, text } = req.body;

  if (!username || !text) {
    return res.status(400).json({ error: "username and text are required" });
  }

  const insertPayload = {
    user_id: req.user.id,
    username: String(username),
    text: String(text)
  };

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert(insertPayload)
    .select("id, username, text, created_at")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({
    id: data.id,
    username: data.username,
    text: data.text,
    timestamp: data.created_at
  });
});

// Export for Vercel serverless runtime
module.exports = app;
