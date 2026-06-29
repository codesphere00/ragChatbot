"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

// Configure axios to always send cookies for credentials
const API_URL = "http://localhost:5000";
axios.defaults.withCredentials = true;

interface User {
  id: number;
  name: string;
  email: string;
}

interface Message {
  role: "user" | "bot";
  text: string;
}

export default function Home() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");

  // Chat & Upload state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/me`);
        if (res.data && res.data.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        // Not logged in, keep user as null
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isRegister) {
        const res = await axios.post(`${API_URL}/api/auth/register`, {
          name,
          email,
          password,
        });
        setUser(res.data.user);
      } else {
        const res = await axios.post(`${API_URL}/api/auth/login`, {
          email,
          password,
        });
        setUser(res.data.user);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.message || "Authentication Failed");
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
      setUser(null);
      setMessages([]);
      setUploadStatus("");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleFileUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const files = e.target.files;

  if (!files || files.length === 0) return;

  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  setUploadStatus(
    `Uploading ${files.length} PDFs...`
  );

  setIsUploading(true);

  try {
    const res = await axios.post(
      `${API_URL}/api/documents/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    setUploadStatus(
      `Uploaded ${res.data.totalFiles} PDFs and stored ${res.data.totalChunks} chunks.`
    );
  } catch (err: any) {
    setUploadStatus(
      err.response?.data?.message ||
      "Upload failed"
    );
  } finally {
    setIsUploading(false);
  }
};

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isSending) return;

    const userMessage: Message = { role: "user", text: inputQuestion };
    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion("");
    setIsSending(true);

    // Add an empty placeholder message for the bot to stream into
    const botPlaceholder: Message = { role: "bot", text: "" };
    setMessages((prev) => [...prev, botPlaceholder]);

    try {
      const response = await fetch(`${API_URL}/api/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userMessage.text }),
        credentials: "include", // Pass auth cookies
      });

      if (!response.ok) {
        // Parse error message (e.g. Rate Limit 429 error)
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Failed to connect to the server");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader available");

      let botText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
        // Split data chunks by double newline
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                botText += ` [Error: ${parsed.error}]`;
              } else if (parsed.text) {
                botText += parsed.text;
              }

              // Update the last bot message in UI with accumulated text
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "bot",
                  text: botText,
                };
                return updated;
              });
            } catch (err) {
              // Ignore incomplete chunks at borders
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          text: err.message || "Error connecting to AI server.",
        };
        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-white font-medium">
        Loading RAG Chatbot...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>

            {authError && <div className="text-red-400 text-sm">{authError}</div>}

            <button
              type="submit"
              className="w-full py-3 mt-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
            >
              {isRegister ? "Sign Up" : "Log In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? "Already have an account?" : "New to the platform?"}{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setAuthError("");
              }}
              className="text-indigo-400 hover:underline focus:outline-none"
            >
              {isRegister ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto w-full p-4">
      <header className="flex flex-wrap items-center justify-between p-4 mb-4 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-xl gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Company RAG Chatbot</h1>
          <p className="text-xs text-slate-400">Logged in as {user.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Upload PDF"}
          </button>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>

        {uploadStatus && (
          <div className="w-full text-xs text-slate-300 border-t border-white/5 pt-2">
            Status: {uploadStatus}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto mb-4 p-4 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex flex-col space-y-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8">
            <p className="font-medium text-lg mb-1">No conversation yet</p>
            <p className="text-sm">Upload a company PDF above and ask questions about it below!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-slate-800 text-slate-100 rounded-bl-none border border-white/5"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm border border-white/5">
              Bot is typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={handleAskQuestion} className="flex gap-2">
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask a question about the uploaded document..."
          className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputQuestion.trim() || isSending}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}